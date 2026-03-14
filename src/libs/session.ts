"use server"

// src/lib/session.ts
//
// Server-side session utilities for SolidStart.
//
// We store the SurrealDB JWT in an HttpOnly cookie called "ace_token".
// This keeps the token out of JS and safe from XSS.
//
// The client-side SurrealProvider also needs the token for reactive
// queries — we pass it back in the signup/signin JSON response body
// so the client can store it in memory (not localStorage).
//
// Helpers:
//   getSessionToken(event)    → string | null   (read cookie)
//   setSessionCookie(token)   → ResponseInit     (set-cookie header fragment)
//   clearSessionCookie()      → ResponseInit     (expire the cookie)
//   getAuthenticatedPlayer(event) → PlayerRecord | null  (full validation)

import type { APIEvent } from "@solidjs/start/server";
import { validateToken, type PlayerRecord } from "./auth";

const COOKIE_NAME = "ace_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — matches scope SESSION 30d

// ── Cookie read ───────────────────────────────────────────────────────────────

export function getSessionToken(request: Request): string | null {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookies = Object.fromEntries(
        cookieHeader.split(";").map(c => {
            const [k, ...v] = c.trim().split("=");
            return [k.trim(), v.join("=").trim()];
        })
    );
    return cookies[COOKIE_NAME] ?? null;
}

// ── Cookie write ──────────────────────────────────────────────────────────────

export function buildSetCookieHeader(token: string): string {
    return [
        `${COOKIE_NAME}=${token}`,
        `Max-Age=${COOKIE_MAX_AGE}`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Strict`,
        // Add `Secure` in production
        ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
    ].join("; ");
}

export function buildClearCookieHeader(): string {
    return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}

// ── Authenticated player from request ────────────────────────────────────────
// Checks cookie first, then Authorization header (for API clients).
// Returns null rather than throwing — let callers decide how to respond.

export async function getAuthenticatedPlayer(
    request: Request
): Promise<PlayerRecord | null> {
    // Prefer cookie (browser sessions)
    const cookieToken = getSessionToken(request);
    if (cookieToken) {
        try {
            return await validateToken(cookieToken);
        } catch {
            // Cookie present but invalid/expired — fall through
        }
    }

    // Fall back to Authorization: Bearer (API clients, mobile, etc.)
    const authHeader = request.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
        const bearerToken = authHeader.slice(7).trim();
        try {
            return await validateToken(bearerToken);
        } catch {
            return null;
        }
    }

    return null;
}

// ── Guard helper ──────────────────────────────────────────────────────────────
// Use in API routes that require auth. Returns player or a 401 Response.

export async function guardRoute(
    request: Request
): Promise<PlayerRecord | Response> {
    const player = await getAuthenticatedPlayer(request);
    if (!player) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }
    return player;
}