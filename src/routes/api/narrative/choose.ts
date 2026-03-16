// src/routes/api/narrative/choose.ts
// POST /api/narrative/choose  — requires authentication
//
// Steps 3–7 of ACE: Player selects option → Hero validates →
// World Graph mutates → Swarm reacts → Lore event appended.
//
// We verify the session belongs to the authenticated player before
// resolving the choice — prevents one player from driving another's session.

import type { APIEvent } from "@solidjs/start/server";
import { resolveChoice } from "~/agentic/orchestrator";
import { guardRoute } from "~/libs/session";
import { getDB } from "~/libs/surreal";
import type { GameSession, NarrativeBeat } from "~/libs/types";

export async function POST(event: APIEvent) {
    const playerOrResponse = await guardRoute(event.request);
    if (playerOrResponse instanceof Response) return playerOrResponse;
    const player = playerOrResponse;

    try {
        const body = await event.request.json();
        const { session, beat, chosenOptionId } = body as {
            session: GameSession;
            beat: NarrativeBeat;
            chosenOptionId: string;
        };

        if (!session || !beat || !chosenOptionId) {
            return new Response(
                JSON.stringify({ error: "session, beat, and chosenOptionId are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Verify this session belongs to the authenticated player
        if (session.playerId !== player.id) {
            return new Response(
                JSON.stringify({ error: "Session does not belong to authenticated player" }),
                { status: 403, headers: { "Content-Type": "application/json" } }
            );
        }

        // Stamp active session on player record
        try {
            const db = await getDB();
            await db.query(
                `UPDATE $id SET active_session_id = $sid, last_seen = time::now()`,
                { id: player.id, sid: session.sessionId }
            );
        } catch { /* non-fatal */ }

        const resolved = await resolveChoice(session, beat, chosenOptionId);

        return new Response(JSON.stringify(resolved), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[POST /api/narrative/choose]", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}