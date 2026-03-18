"use server";

// src/routes/api/games/index.ts
// GET  /api/games        — list the authenticated player's games
// POST /api/games        — create a new game record (called at World Forge start)

import type { APIEvent } from "@solidjs/start/server";
import { guardRoute } from "~/libs/session";
import { createGame, getPlayerGames } from "~/libs/game";

export async function GET(event: APIEvent) {
    console.log('GET /api/games');
    const playerOrResponse = await guardRoute(event.request);
    if (playerOrResponse instanceof Response) return playerOrResponse;
    const player = playerOrResponse;

    try {
        const games = await getPlayerGames(player.id);
        console.log('games', games);
        return new Response(JSON.stringify({ games }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}

export async function POST(event: APIEvent) {
    const playerOrResponse = await guardRoute(event.request);
    if (playerOrResponse instanceof Response) return playerOrResponse;
    const player = playerOrResponse;

    try {
        const body = await event.request.json();
        const { name, tagline = "", description = "", genre = "", cost_tier = "free", cost = 0, sourceFile = "" } = body;

        if (!name?.trim()) {
            return new Response(JSON.stringify({ error: "name is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const game = await createGame(player.id, {
            name: name.trim(),
            tagline: tagline.trim(),
            description: description.trim(),
            genre: genre.trim(),
            cost_tier,
            cost,
            sourceFile,
        });

        return new Response(JSON.stringify({ game }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}