"use server";
// src/routes/api/games/by-slug/[slug].ts
// GET /api/games/by-slug/:slug
//
// Resolves a URL slug (e.g. "the-serpent-and-the-spy") to a full game record.
//
// We match the slug in JavaScript using the same logic GameCard uses client-side:
//   title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
//
// This is more reliable than SurrealDB's string::slug() which can strip
// different characters and produce mismatched results.
//
// No auth required — GameDetail is a public preview page.

import type { APIEvent } from "@solidjs/start/server";
import { getDB } from "~/libs/surreal";

export async function GET(event: APIEvent) {
    const slug = event.params.slug;

    if (!slug) {
        return new Response(JSON.stringify({ error: "slug is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const db = await getDB();

        // Client-side slug logic (must match GameCard.handleShowMore exactly):
        const toSlug = (name: string) =>
            name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Fetch all visible/ready games and match in JS.
        const [candidates] = await db.query<[any[]]>(`
            SELECT * FROM game
            WHERE visibility = 'public' OR status = 'ready'
            LIMIT 200
        `);

        const game = (candidates ?? []).find(
            (g: any) => toSlug(g.name ?? '') === slug
        ) ?? null;

        if (!game) {
            console.warn(`[/api/games/by-slug] no game found for slug: ${slug}`);
            return new Response(JSON.stringify({ error: "Game not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Serialize RecordId → plain string so JSON.stringify works correctly
        const serialized = { ...game, id: game.id?.toString?.() ?? String(game.id) };

        return new Response(JSON.stringify({ game: serialized }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[/api/games/by-slug] error:", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}