"use server";
// src/routes/api/auth/me.ts
// GET /api/auth/me
//
// Returns the authenticated player record.
// Used by hydrateFromCookie() on app mount to restore session.
// Checks HttpOnly cookie first, then Authorization header.

import type { APIEvent } from "@solidjs/start/server";
import { getAuthenticatedPlayer } from "~/libs/session";

export async function GET(event: APIEvent) {
    const player = await getAuthenticatedPlayer(event.request);

    if (!player) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ player }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}