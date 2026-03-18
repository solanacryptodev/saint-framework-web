"use server";

// src/routes/api/lore/ingest.ts
//
// POST /api/lore/ingest — requires authentication
//
// Accepts multipart/form-data:
//   loreBible  (File)    — the .md lore bible
//   gameId     (string)  — the game record to attach this world to
//
// Streams SSE progress. Updates game.status:
//   draft → initializing → review
//
// GET /api/lore/ingest — returns current graph counts

import type { APIEvent } from "@solidjs/start/server";
import { ingestLoreBible } from "~/agentic/lore-ingestion-agent";
import { guardRoute } from "~/libs/session";
import { getGame, updateGameStatus, updateGameInfo, getPlayerDisplayName, updateGameCreatedBy } from "~/libs/game";
import { getDB } from "~/libs/surreal";
import type { IngestionProgress } from "~/libs/types";

// SurrealDB record IDs can come back as "player:01j..." or as a RecordId object.
// This normalizes both to just the raw ID part for comparison.
function normalizeId(id: unknown): string {
    if (!id) return "";
    const s = String(id);
    // Strip table prefix: "player:01j..." → "01j..."
    const colon = s.indexOf(":");
    return colon >= 0 ? s.slice(colon + 1) : s;
}

export async function POST(event: APIEvent) {
    const playerOrResponse = await guardRoute(event.request);
    if (playerOrResponse instanceof Response) return playerOrResponse;
    const player = playerOrResponse;

    const contentType = event.request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
        return new Response(JSON.stringify({ error: "Use multipart/form-data" }), {
            status: 415, headers: { "Content-Type": "application/json" },
        });
    }

    const formData = await event.request.formData();
    const file = formData.get("loreBible") as File | null;
    const gameId = formData.get("gameId") as string | null;

    if (!file) {
        return new Response(JSON.stringify({ error: "No file provided. Field name: loreBible" }), {
            status: 400, headers: { "Content-Type": "application/json" },
        });
    }
    if (!file.name.endsWith(".md") && !file.name.endsWith(".markdown")) {
        return new Response(JSON.stringify({ error: "Only .md / .markdown files are accepted" }), {
            status: 400, headers: { "Content-Type": "application/json" },
        });
    }

    if (gameId) {
        const game = await getGame(gameId);
        if (!game) return new Response(JSON.stringify({ error: "Game not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        // Normalize both IDs — SurrealDB may return RecordId objects or "table:id" strings
        // console.log("game.creator_id", game.creator_id);
        // console.log("player.id", player.id);
        // console.log("normalized", normalizeId(game.creator_id), normalizeId(player.id));
        if (normalizeId(game.creator_id) !== normalizeId(player.id)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
        await updateGameStatus(gameId, "initializing");
    }

    const markdown = await file.text();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) =>
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));

            try {
                const report = await ingestLoreBible(
                    markdown,
                    file.name,
                    (progress: IngestionProgress) => send({ type: "progress", ...progress })
                );

                if (gameId) {
                    await updateGameStatus(gameId, "review", {
                        lore_nodes: report.nodesWritten.length,
                        lore_edges: report.edgesWritten.length,
                        world_agents: report.worldReport?.agentsPlaced.length ?? 0,
                        world_locations: report.worldReport?.locationsCreated.length ?? 0,
                        world_items: report.worldReport?.itemsPlaced.length ?? 0,
                        world_concepts: report.worldReport?.conceptsCreated.length ?? 0,
                        world_events: report.worldReport?.eventsCreated.length ?? 0,
                        world_threads: report.worldReport?.threadsOpened.length ?? 0,
                    });

                    // Apply parsed game info (description, genre, tags) from lore bible
                    if (report.gameInfo) {
                        await updateGameInfo(gameId, report.gameInfo);
                    }

                    // Update created_by with player's display name
                    const displayName = await getPlayerDisplayName(player.id);
                    await updateGameCreatedBy(gameId, displayName);
                }

                send({ type: "complete", report });
            } catch (err) {
                if (gameId) await updateGameStatus(gameId, "draft").catch(() => { });
                send({ type: "error", message: String(err) });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}

export async function GET(_event: APIEvent) {
    try {
        const db = await getDB();
        const [[nodes], [edges], [nodesByKind]] = await Promise.all([
            db.query<[{ count: number }[]]>(`SELECT count() AS count FROM lore_node GROUP ALL`),
            db.query<[{ count: number }[]]>(`SELECT count() AS count FROM lore_relation GROUP ALL`),
            db.query<[{ kind: string; count: number }[]]>(`SELECT kind, count() AS count FROM lore_node GROUP BY kind`),
        ]);
        return new Response(JSON.stringify({
            totalNodes: nodes?.[0]?.count ?? 0,
            totalEdges: edges?.[0]?.count ?? 0,
            byKind: nodesByKind ?? [],
        }), { headers: { "Content-Type": "application/json" } });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}