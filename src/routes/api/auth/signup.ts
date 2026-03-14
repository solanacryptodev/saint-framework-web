"use server";
// src/routes/api/auth/signup.ts
// POST /api/auth/signup
//
// Creates a new player account via SurrealDB scope signup.
// Sets HttpOnly cookie and returns { token, player }.

import type { APIEvent } from "@solidjs/start/server";
import { signup, type SignupParams } from "~/libs/auth";
import { buildSetCookieHeader } from "~/libs/session";

export async function POST(event: APIEvent) {
    try {
        const body = await event.request.json();

        // Validate required fields
        const required = ["username", "email", "password"];
        for (const field of required) {
            if (!body[field] || typeof body[field] !== "string") {
                return new Response(
                    JSON.stringify({ error: `${field} is required` }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }
        }

        const params: SignupParams = {
            username: body.username.trim(),
            email: body.email.trim().toLowerCase(),
            password: body.password,
            first_name: body.first_name?.trim() ?? "",
            last_name: body.last_name?.trim() ?? "",
            display_name: body.display_name?.trim() ?? body.username.trim(),
            tier: body.tier ?? "free",
        };

        const { token, player } = await signup(params);

        return new Response(JSON.stringify({ token, player }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": buildSetCookieHeader(token),
            },
        });
    } catch (err: any) {
        console.error("Signup error:", err);

        // Surface friendly errors for common SurrealDB constraint violations
        const msg = err?.message ?? String(err);
        let errorMessage = "Signup failed";

        if (msg.includes("uniqueness") || msg.includes("already exists")) {
            errorMessage = "Username or email is already taken";
        } else if (msg.includes("authenticate") || msg.includes("credentials")) {
            errorMessage = "Signup succeeded but authentication failed";
        } else if (msg.includes("required")) {
            errorMessage = msg;
        }

        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
}