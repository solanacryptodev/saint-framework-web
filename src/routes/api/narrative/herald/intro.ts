"use server";

// src/routes/api/narrative/herald/intro.ts
//
// POST /api/narrative/herald/intro
//
// Generates the Herald's opening monologue shown before character creation.
// Returns the monologue text and the character template.
//
// The Herald speaks directly to the player before they enter the world.
// This is NOT the narrator — it's the voice of the threshold.

import { json } from "@solidjs/router";
import { getAuthenticatedPlayer } from "~/libs/session";
import { getGame } from "~/libs/game";
import { generateHeraldIntro } from "~/agentic/game/herald-agent";

export async function POST({ request }: { request: Request }) {
    const player = await getAuthenticatedPlayer(request);
    if (!player) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { gameId } = body;
    if (!gameId || typeof gameId !== "string") {
        return json({ error: "gameId required" }, { status: 400 });
    }

    try {
        const game = await getGame(gameId);
        if (!game) {
            return json({ error: "Game not found" }, { status: 404 });
        }

        const result = await generateHeraldIntro(game, gameId);

        return json({
            monologue: result.monologue,
            template: result.characterTemplate,
        });
    } catch (err) {
        console.error("[Herald/intro]", err);
        return json(
            { error: err instanceof Error ? err.message : "Failed to generate intro" },
            { status: 500 }
        );
    }
}
