'use client'

// src/lib/auth-store.ts
//
// Client-side reactive auth state.
//
// The JWT lives in two places:
//   • HttpOnly cookie  — set by the server, sent automatically on every
//                        request, invisible to JS. This is the session.
//   • In-memory signal — available to the SurrealProvider so it can
//                        authenticate client-side live queries.
//                        Intentionally NOT in localStorage (XSS risk).
//
// On page load, we call /api/auth/me to check if the cookie is still
// valid and hydrate the player. No token is stored client-side at rest.

import { createSignal, createResource } from "solid-js";
import { createStore } from "solid-js/store";

export interface Player {
    id: string;
    username: string;
    email: string;
    display_name: string;
    created_at: string;
    last_seen: string;
    active_session_id: string | null;
    preferences: Record<string, unknown>;
}

interface AuthStore {
    player: Player | null;
    token: string | null;         // in-memory only — for SurrealProvider
    isLoading: boolean;
    error: string | null;
}

// ── Store ──────────────────────────────────────────────────────────────────

const [auth, setAuth] = createStore<AuthStore>({
    player: null,
    token: null,
    isLoading: false,
    error: null,
});

export { auth };

// ── Actions ────────────────────────────────────────────────────────────────

export async function signup(params: {
    username: string;
    email: string;
    password: string;
    display_name?: string;
}): Promise<void> {
    setAuth({ isLoading: true, error: null });

    const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        credentials: "include",  // receive Set-Cookie
    });

    const data = await res.json();

    if (!res.ok) {
        setAuth({ isLoading: false, error: data.error ?? "Signup failed" });
        throw new Error(data.error);
    }

    setAuth({
        player: data.player,
        token: data.token,   // keep in memory for SurrealProvider
        isLoading: false,
        error: null,
    });
}

export async function signin(params: {
    identifier: string;
    password: string;
}): Promise<void> {
    setAuth({ isLoading: true, error: null });

    const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
        setAuth({ isLoading: false, error: data.error ?? "Signin failed" });
        throw new Error(data.error);
    }

    setAuth({
        player: data.player,
        token: data.token,
        isLoading: false,
        error: null,
    });
}

export async function signout(): Promise<void> {
    await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
    });
    setAuth({ player: null, token: null, error: null, isLoading: false });
}

export async function hydrateFromCookie(): Promise<void> {
    // Called on app mount — checks if an existing cookie session is valid
    setAuth({ isLoading: true });

    const res = await fetch("/api/auth/me", { credentials: "include" });

    if (res.ok) {
        const data = await res.json();
        // Cookie was valid — but we don't have the raw token client-side
        // (it's HttpOnly). Player is hydrated; SurrealProvider will stay
        // in server-only mode until next signin provides a fresh token.
        setAuth({ player: data.player, isLoading: false });
    } else {
        setAuth({ player: null, isLoading: false });
    }
}

export async function setFromToken(token: string, player: Player): Promise<void> {
    // Set the HttpOnly cookie via API route
    await fetch("/api/auth/setCookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
    });

    // Update in-memory state
    setAuth({
        player,
        token,
        isLoading: false,
        error: null,
    });
}

// ── Computed ───────────────────────────────────────────────────────────────

export const isAuthenticated = () => auth.player !== null;
export const currentPlayer = () => auth.player;
export const authToken = () => auth.token;