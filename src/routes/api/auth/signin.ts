"use server";
// src/routes/api/auth/signin.ts
// POST /api/auth/signin
//
// Authenticates a player via SurrealDB scope signin.
// Sets HttpOnly cookie and returns { token, player }.

import type { APIEvent } from "@solidjs/start/server";
import { signin, type SigninParams } from "~/libs/auth";
import { buildSetCookieHeader } from "~/libs/session";

export async function POST(event: APIEvent) {
    try {
        const body = await event.request.json();

        // Validate required fields
        if (!body.identifier || typeof body.identifier !== "string") {
            return new Response(
                JSON.stringify({ error: "identifier (username or email) is required" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        if (!body.password || typeof body.password !== "string") {
            return new Response(
                JSON.stringify({ error: "password is required" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const params: SigninParams = {
            identifier: body.identifier.trim(),
            password: body.password,
        };

        const { token, player } = await signin(params);

        return new Response(JSON.stringify({ token, player }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": buildSetCookieHeader(token),
            },
        });
    } catch (err: any) {
        console.error("Signin error:", err);

        const msg = err?.message ?? String(err);
        let errorMessage = "Signin failed";

        if (msg.includes("authenticate") || msg.includes("credentials") || msg.includes("password")) {
            errorMessage = "Invalid username/email or password";
        } else if (msg.includes("not found")) {
            errorMessage = "Account not found";
        }

        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }
}