"use server";

// src/routes/api/narrative/herald/resume.ts
//
// POST /api/narrative/herald/resume
//
// Generates a brief "the world remembers you" line for returning players.
// This is shown when a player re-enters a game they've already started.
//
// Unlike the intro (which is full and atmospheric), this is short — 1-2 sentences.
// The world noticed their absence. Something has shifted.

import { json } from "@solidjs/router";
import { getAuthenticatedPlayer } from "~/libs/session";
import { getGame } from "~/libs/game";
import { getPlayerCharacterForGame } from "~/libs/player-character";
import { buildHeraldAgent } from "~/agentic/game/herald-agent";
import { resolveGenreTone } from "~/libs/session-engine";

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

    const { gameId, characterName } = body;
    if (!gameId || typeof gameId !== "string") {
        return json({ error: "gameId required" }, { status: 400 });
    }
    if (!characterName || typeof characterName !== "string") {
        return json({ error: "characterName required" }, { status: 400 });
    }

    try {
        const game = await getGame(gameId);
        if (!game) {
            return json({ error: "Game not found" }, { status: 404 });
        }

        // Verify the player has a character for this game
        const character = await getPlayerCharacterForGame(player.id, gameId);
        if (!character) {
            return json({ error: "No character found for this player and game" }, { status: 404 });
        }

        // Generate the brief resume line using the Herald
        const tone = resolveGenreTone(game.genre);
        const herald = buildHeraldAgent(tone);

        const result = await herald.generate([
            {
                role: "user",
                content: `
Write a single sentence (maximum two) welcoming ${characterName} back to ${game.name}.
The world has continued without them. Something has shifted.
Do not say "welcome back". Make it feel like the world noticed their absence.
                `.trim(),
            },
        ]);

        return json({
            monologue: result.text.trim(),
        });
    } catch (err) {
        console.error("[Herald/resume]", err);
        return json(
            { error: err instanceof Error ? err.message : "Failed to generate resume line" },
            { status: 500 }
        );
    }
}
