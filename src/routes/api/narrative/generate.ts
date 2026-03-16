// src/routes/api/narrative/generate.ts
// POST /api/narrative/generate  — requires authentication
//
// Step 1+2 of the ACE loop: Curators build context → Generators produce options.
// playerId is pulled from the verified token — clients cannot spoof it.

import type { APIEvent } from "@solidjs/start/server";
import { generateOptions } from "~/agentic/orchestrator";
import { guardRoute } from "~/libs/session";
import type { GameSession } from "~/libs/types";

export async function POST(event: APIEvent) {
    const playerOrResponse = await guardRoute(event.request);
    if (playerOrResponse instanceof Response) return playerOrResponse;
    const player = playerOrResponse;

    try {
        const body = await event.request.json();
        const { sessionId, turnNumber = 1, narrativeThreads = [], choiceHistory = [] } = body;

        if (!sessionId) {
            return new Response(
                JSON.stringify({ error: "sessionId is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const session: GameSession = {
            sessionId,
            playerId: player.id,  // from verified token
            startedAt: new Date().toISOString(),
            turnNumber,
            narrativeThreads,
            choiceHistory,
        };

        const beat = await generateOptions(session);

        return new Response(JSON.stringify({ beat }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[POST /api/narrative/generate]", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}