"use server";
// src/routes/api/auth/setCookie.ts
// POST /api/auth/setCookie
//
// Called by JoinForm after a successful WS signup.
// The client has the token (from client.signup()) but needs it in the
// HttpOnly cookie so server-side API routes authenticate correctly.
//
// We validate the token before setting it — no arbitrary tokens accepted.

import type { APIEvent } from "@solidjs/start/server";
import { validateToken } from "~/libs/auth";
import { buildSetCookieHeader } from "~/libs/session";

export async function POST(event: APIEvent) {
    try {
        const { token } = await event.request.json();

        if (!token || typeof token !== "string") {
            return new Response(JSON.stringify({ error: "token is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Validate before trusting
        await validateToken(token);

        return new Response(JSON.stringify({ ok: true }), {
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": buildSetCookieHeader(token),
            },
        });
    } catch {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }
}