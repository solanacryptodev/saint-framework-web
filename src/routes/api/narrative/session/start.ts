"use server";

// src/routes/api/narrative/session/start.ts
//
// POST /api/narrative/session/start
//
// The single entry point for all session lifecycle operations.
// Handles three modes in one route:
//
//   mode: "new"    — new player, creates character + starts session
//   mode: "resume" — returning player, resumes existing session
//   mode: "turn"   — player has chosen an option, run the next turn (supports SSE)
//
// The engine instance lives in SESSION_CACHE (session-engine.ts).
// This route is the only thing that touches both session-engine and saint-engine.

import { json } from "@solidjs/router";
import type { TurnProgress } from "~/libs/types";
import { getAuthenticatedPlayer } from "~/libs/session";
import { getGame } from "~/libs/game";
import { getDB } from "~/libs/surreal";
import {
    startSession,
    resumeSession,
    getEngineFromCache,
} from "~/libs/session-engine";
import { Table } from "surrealdb";
import { sanitizeGameId } from "~/libs/game";

// ── POST handler ───────────────────────────────────────────────────────────

export async function POST({ request }: { request: Request }) {
    const player = await getAuthenticatedPlayer(request);
    if (!player) return json({ error: "Unauthorized" }, { status: 401 });

    let body: Record<string, any>;
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { mode } = body;
    if (!mode) return json({ error: "mode required: new | resume | turn" }, { status: 400 });

    try {
        switch (mode) {
            case "new": return await handleNewSession(player, body);
            case "resume": return await handleResumeSession(player, body);
            case "turn": return await handleTurn(player, body);
            default: return json({ error: `Unknown mode: ${mode}` }, { status: 400 });
        }
    } catch (err) {
        console.error(`[Session/${mode}]`, err);
        return json(
            { error: err instanceof Error ? err.message : "Internal error" },
            { status: 500 }
        );
    }
}

// ── Mode: new ──────────────────────────────────────────────────────────────
// New player entering a game for the first time.
// Creates player_character record, starts session, returns sessionId + turn 0.

async function handleNewSession(
    player: { id: string },
    body: Record<string, any>
) {
    const { gameId, displayName, chosenBackstory, chosenTraits, chosenItems } = body;

    if (!gameId) return json({ error: "gameId required" }, { status: 400 });
    if (!displayName) return json({ error: "displayName required" }, { status: 400 });

    const sanitizedGameId = sanitizeGameId(body.gameId);

    const game = await getGame(sanitizedGameId);
    if (!game) return json({ error: "Game not found" }, { status: 404 });
    if (game.status !== "ready") return json({ error: "Game not ready" }, { status: 400 });

    const db = await getDB();

    // Load character template (accept templateId from body for multi-template selection)
    const templateId = body.templateId;
    let template: any = null;

    if (templateId) {
        const [templateRows] = await db.query<[any[]]>(
            `SELECT * FROM player_character_template WHERE id = $tid LIMIT 1`,
            { tid: templateId }
        );
        template = templateRows?.[0];
    } else {
        // Fallback: get first published template
        const [templateRows] = await db.query<[any[]]>(
            `SELECT * FROM player_character_template WHERE game_id = $gid AND status = 'published' LIMIT 1`,
            { gid: sanitizedGameId }
        );
        template = templateRows?.[0];
    }

    if (!template) return json({ error: "No character template found for this game" }, { status: 400 });

    // Create player_character record
    const [character] = await db.create(new Table("player_character")).content({
        game_id: sanitizedGameId,
        player_id: player.id,
        session_id: "PENDING",       // updated after session is created
        template_id: template ? String(template.id) : undefined,  // now optional
        kind: template?.kind ?? "template",  // inherit from template or default to "template"
        display_name: displayName,
        chosen_backstory: chosenBackstory ?? undefined,
        chosen_traits: chosenTraits ?? [],
        chosen_items: chosenItems ?? [],
        portrait_url: undefined,
        world_actor_id: undefined,
    });

    // Start the session — this is where session-engine meets saint-engine
    const { session, engine } = await startSession(
        sanitizedGameId,
        player.id,
        String(character.id)
    );

    // Update the player_character with the real session_id
    await db.query(

        `UPDATE player_character SET session_id = $sid WHERE id = $cid`,
        { sid: session.sessionId, cid: String(character.id) }
    );

    // Find the player world_agent that was copied for this session and link it
    const [agentRows] = await db.query<[any[]]>(
        `SELECT id FROM world_agent WHERE session_id = $sid AND kind = 'player' LIMIT 1`,
        { sid: session.sessionId }
    );
    if (agentRows?.[0]) {
        await db.query(
            `UPDATE player_character SET world_actor_id = $aid WHERE id = $cid`,
            { aid: String(agentRows[0].id), cid: String(character.id) }
        );
    }

    // Run turn 0 — the opening scene, no player choice yet
    const turn0Output = await engine.runTurn({
        sessionId: session.sessionId,
        gameId,
        playerId: player.id,
        chosenOptionId: "",
        chosenOptionText: "",
        worldImpact: {},
        turnNumber: 0,
    });

    return json({
        mode: "new",
        sessionId: session.sessionId,
        characterId: String(character.id),
        scene: turn0Output.sceneDescription,
        options: turn0Output.options,
        phaseState: turn0Output.phaseState,
        eternalRan: turn0Output.eternalRan,
        turnNumber: 0,
    });
}

// ── Mode: resume ───────────────────────────────────────────────────────────
// Returning player re-entering a game they've already started.
// Finds their existing character, resumes the session, returns current state.

async function handleResumeSession(
    player: { id: string },
    body: Record<string, any>
) {
    const { gameId, sessionId: existingSessionId } = body;

    if (!gameId) return json({ error: "gameId required" }, { status: 400 });

    const sanitizedGameId = sanitizeGameId(gameId);

    const db = await getDB();

    // If they passed a sessionId, try to resume it directly
    if (existingSessionId) {
        const resumed = await resumeSession(existingSessionId);
        if (resumed) {
            // Load the most recent beat so they can see where they left off
            const [beatRows] = await db.query<[any[]]>(
                `SELECT * FROM narrative_beat
         WHERE session_id = $sid
         ORDER BY turn_number DESC
         LIMIT 1`,
                { sid: existingSessionId }
            );
            const lastBeat = beatRows?.[0];

            return json({
                mode: "resume",
                sessionId: existingSessionId,
                scene: lastBeat?.scene_description ?? "",
                options: lastBeat?.options ?? [],
                turnNumber: resumed.session.turnNumber,
            });
        }
    }

    // No sessionId passed or it wasn't found — look up by player + game
    const [characterRows] = await db.query<[any[]]>(
        `SELECT * FROM player_character
     WHERE player_id = $pid AND game_id = $gid
     ORDER BY created_at DESC
     LIMIT 1`,
        { pid: player.id, gid: sanitizedGameId }
    );
    const character = characterRows?.[0];
    if (!character) return json({ error: "No character found" }, { status: 404 });

    // Character exists but session was never started
    if (character.session_id === "PENDING") {
        return json({ error: "Session not initialized", code: "PENDING" }, { status: 400 });
    }

    // Resume using the character's session_id
    const resumed = await resumeSession(character.session_id);
    if (!resumed) {
        return json({ error: "Session could not be resumed" }, { status: 500 });
    }

    const [beatRows] = await db.query<[any[]]>(
        `SELECT * FROM narrative_beat
     WHERE session_id = $sid
     ORDER BY turn_number DESC
     LIMIT 1`,
        { sid: character.session_id }
    );
    const lastBeat = beatRows?.[0];

    return json({
        mode: "resume",
        sessionId: character.session_id,
        characterId: String(character.id),
        scene: lastBeat?.scene_description ?? "",
        options: lastBeat?.options ?? [],
        turnNumber: resumed.session.turnNumber,
    });
}

// ── Mode: turn ─────────────────────────────────────────────────────────────
// Player has chosen an option. Run the next turn of the SAINT loop.
// Supports SSE streaming when stream=true is passed in the body.
// This is the hot path — called every time the player makes a choice.

async function handleTurn(
    player: { id: string },
    body: Record<string, any>
) {
    const {
        sessionId,
        gameId,
        chosenOptionId,
        chosenOptionText,
        worldImpact,
        turnNumber,
        stream,
    } = body;

    if (!sessionId) return json({ error: "sessionId required" }, { status: 400 });
    if (!gameId) return json({ error: "gameId required" }, { status: 400 });
    if (!chosenOptionId) return json({ error: "chosenOptionId required" }, { status: 400 });

    const sanitizedGameId = sanitizeGameId(gameId);

    // Get the engine from cache — or rebuild it if evicted
    let engine = getEngineFromCache(sessionId);
    if (!engine) {
        const resumed = await resumeSession(sessionId);
        if (!resumed) return json({ error: "Session not found" }, { status: 404 });
        engine = resumed.engine;
    }

    // ── SSE Streaming Mode ─────────────────────────────────────────────────
    if (stream === true) {
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                // Helper to send SSE event with type included in data payload
                // The client reads event.type from the parsed JSON data
                const sendEvent = (type: string, data: any) => {
                    const payload = `data: ${JSON.stringify({ type, ...data })}\n\n`;
                    controller.enqueue(encoder.encode(payload));
                };

                try {
                    // Run the turn with progress callbacks
                    // The onProgress callback receives TurnProgress and sends SSE events
                    const output = await engine.runTurn(
                        {
                            sessionId,
                            gameId: sanitizedGameId,
                            playerId: player.id,
                            chosenOptionId,
                            chosenOptionText: chosenOptionText ?? "",
                            worldImpact: worldImpact ?? {},
                            turnNumber: turnNumber ?? 1,
                        },
                        // onProgress fires at each agent transition with narrative messages
                        (progress) => sendEvent("progress", { phase: progress.phase, message: progress.message })
                    );

                    // Update session turn_number in DB
                    const db = await getDB();
                    await db.query(
                        `UPDATE game_session
                         SET turn_number    = $tn,
                             last_active_at = time::now()
                         WHERE session_id   = $sid`,
                        { tn: output.beat.turnNumber, sid: sessionId }
                    );

                    // Send completion event with full result
                    sendEvent("complete", {
                        mode: "turn",
                        sessionId,
                        scene: output.sceneDescription,
                        options: output.options,
                        phaseState: output.phaseState,
                        eternalRan: output.eternalRan,
                        toolCalls: output.toolCallCount,
                        durationMs: output.durationMs,
                        turnNumber: output.beat.turnNumber,
                    });

                } catch (err) {
                    console.error("[Session/turn/stream]", err);
                    sendEvent("error", {
                        message: err instanceof Error ? err.message : "Turn processing failed",
                    });
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

    // ── Non-streaming Mode (legacy) ────────────────────────────────────────
    // Run the turn — this is where session-engine and saint-engine fully merge
    const output = await engine.runTurn({
        sessionId,
        gameId: sanitizedGameId,
        playerId: player.id,
        chosenOptionId,
        chosenOptionText: chosenOptionText ?? "",
        worldImpact: worldImpact ?? {},
        turnNumber: turnNumber ?? 1,
    });

    // Update the session's turn_number and last_active_at in DB
    const db = await getDB();
    await db.query(
        `UPDATE game_session
     SET turn_number    = $tn,
         last_active_at = time::now()
     WHERE session_id   = $sid`,
        { tn: output.beat.turnNumber, sid: sessionId }
    );

    return json({
        mode: "turn",
        sessionId,
        scene: output.sceneDescription,
        options: output.options,
        phaseState: output.phaseState,
        eternalRan: output.eternalRan,
        toolCalls: output.toolCallCount,
        durationMs: output.durationMs,
        turnNumber: output.beat.turnNumber,
    });
}
