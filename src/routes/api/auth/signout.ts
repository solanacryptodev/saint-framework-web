"use server";

import type { APIEvent } from "@solidjs/start/server";
import { buildClearCookieHeader, getSessionToken } from "~/libs/session";
import { signout } from "~/libs/auth";

export async function POST(event: APIEvent) {
    const token = getSessionToken(event.request);

    if (token) {
        await signout(token); // clears active_session_id on the player record
    }

    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Set-Cookie": buildClearCookieHeader(),
        },
    });
}