"use server";

// src/routes/api/games/public.ts
// GET /api/games/public — list public games (no authentication required)

import type { APIEvent } from "@solidjs/start/server";
import { getPublicGames } from "~/libs/game";

// SurrealDB v2 returns `id` as a RecordId object { tb, id }.
// We need to convert it to a plain string like "game:01j..." before
// JSON.stringify so the client receives a usable string (not "[object Object]").
function serializeGames(games: any[]): any[] {
    return games.map(g => ({
        ...g,
        id: g.id?.toString?.() ?? String(g.id),
    }));
}

export async function GET(event: APIEvent) {
    try {
        const games = await getPublicGames();
        console.log('[/api/games/public] returning', games.length, 'games');
        return new Response(JSON.stringify({ games: serializeGames(games) }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[/api/games/public] error:", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}