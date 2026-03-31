"use server";

// src/routes/api/games/[gameId]/character.ts
//
// GET /api/games/:gameId/character
//   Returns all published character templates for a game, plus whether the player already has one.
//
// POST /api/games/:gameId/character
//   Creates a player_character record from the selected template.
//   Handles both template (player customizes) and prebuilt (player picks, no customization) flows.

import { json } from "@solidjs/router";
import { getAuthenticatedPlayer } from "~/libs/session";
import { getGame } from "~/libs/game";
import { getDB } from "~/libs/surreal";
import {
    getCharacterTemplates,
    getCharacterTemplateById,
    getPlayerCharacterForGame,
    createPlayerCharacter,
} from "~/libs/player-character";
import type { PlayerCharacterTemplate, PlayerCharacter } from "~/libs/types";
import { sanitizeGameId } from "~/libs/game";

//── GET handler ────────────────────────────────────────────────────────────

export async function GET({ params, request }: { params: { gameId: string }; request: Request }) {
    const { gameId } = params;
    const cleanId = sanitizeGameId(gameId);
    console.log("sanitized gameId", cleanId);

    if (!gameId) {
        return json({ error: "gameId required" }, { status: 400 });
    }

    // Auth is required to check character status
    const player = await getAuthenticatedPlayer(request);
    if (!player) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all published templates for this game
    const templates = await getCharacterTemplates(cleanId, "published");

    // Check if player already has a character for this game
    const existingCharacter = await getPlayerCharacterForGame(player.id, cleanId);
    const hasCharacter = existingCharacter !== null;

    return json({
        templates,
        hasCharacter,
        existingCharacter: existingCharacter ?? undefined,
    });
}

// ── POST handler ────────────────────────────────────────────────────────────

export async function POST({ params, request }: { params: { gameId: string }; request: Request }) {
    const { gameId } = params;
    // console.log("gameId", gameId);


    if (!gameId) {
        return json({ error: "gameId required" }, { status: 400 });
    }

    const player = await getAuthenticatedPlayer(request);
    if (!player) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    // console.log("player", player);

    let body: Record<string, any>;
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { templateId } = body;
    // console.log("[POST /character] templateId:", templateId);

    // Load the template
    let template: PlayerCharacterTemplate | null = null;
    if (templateId) {
        template = await getCharacterTemplateById(templateId);
        // console.log("template 1", template);
    } else {
        // Fallback: get first published template
        const templates = await getCharacterTemplates(gameId, "published");
        template = templates[0] ?? null;
        // console.log("templates 2", templates);
    }

    if (!template) {
        return json({ error: "No character template found" }, { status: 404 });
    }

    // Verify template belongs to this game
    if (template.game_id !== gameId) {
        return json({ error: "Template does not belong to this game" }, { status: 400 });
    }

    // Check if player already has a character
    const existing = await getPlayerCharacterForGame(player.id, gameId);
    if (existing) {
        return json({ error: "Player already has a character for this game" }, { status: 409 });
    }

    // Handle prebuilt vs template flow
    const isPrebuilt = template.kind === "prebuilt";

    const displayName = isPrebuilt
        ? template.base_name  // prebuilt: use template name
        : (body.displayName?.trim() ?? template.base_name);

    const chosenBackstory = isPrebuilt
        ? template.prebuilt_backstory ?? null
        : (body.chosenBackstory ?? null);

    const chosenTraits = isPrebuilt
        ? (template.prebuilt_traits ?? [])
        : (body.chosenTraits ?? []);

    const chosenItems = isPrebuilt
        ? (template.prebuilt_items ?? [])
        : (body.chosenItems ?? []);

    // Create the player character record
    let character: PlayerCharacter;
    try {
        character = await createPlayerCharacter({
            game_id: gameId,
            player_id: player.id,
            session_id: "PENDING",
            template_id: template.id ? String(template.id) : undefined,
            kind: template.kind,
            display_name: displayName,
            portrait_url: template.portrait_url ?? undefined,  // null → undefined
            chosen_backstory: chosenBackstory ?? undefined,        // null → undefined
            chosen_traits: chosenTraits ?? [],
            chosen_items: chosenItems ?? [],
            world_actor_id: undefined,                           // null → undefined
        });
    } catch (err) {
        console.error("[POST /character] create failed:", err);
        return json({ error: String(err) }, { status: 500 });
    }


    // console.log("character", character);

    return json({
        playerCharacter: character,
        isPrebuilt,
    });
}
