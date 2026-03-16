"use client";
// src/lib/AuthProvider.tsx
//
// App-level identity layer. Wraps the entire application.
// Owns signup, signin, signout, and cookie hydration on first load.
//
// ── What this is NOT ──────────────────────────────────────────────────────
//
//   This is NOT a SurrealDB WebSocket connection.
//   Auth state is managed through HTTP API routes + HttpOnly cookies.
//   The SurrealProvider (WebSocket) only mounts inside /play/[gameId]
//   for game-specific live queries. These two layers never overlap.
//
// ── What the docs pattern gives us here ──────────────────────────────────
//
//   The SurrealDB docs show a SurrealProvider wrapping the whole app.
//   We take the same structural idea — a context provider at the root that
//   manages connection/auth state and exposes it to the whole tree — but
//   use it for *identity* rather than a WebSocket connection:
//
//     <AuthProvider>          ← manages who is logged in (whole app)
//       <Router>
//         <Route path="/play/:gameId">
//           <SurrealProvider> ← manages live DB connection (game only)
//             <GameShell />
//           </SurrealProvider>
//         </Route>
//       </Router>
//     </AuthProvider>
//
// ── Token handling ─────────────────────────────────────────────────────────
//
//   HttpOnly cookie (ace_token)
//     Set by server on signin/signup. Sent automatically on every request.
//     Used by all API routes for auth. Invisible to JS.
//
//   In-memory token (auth.token)
//     Returned in the signin/signup response body. Held in the auth store.
//     Passed to SurrealProvider so client-side live queries are scoped to
//     the correct player. Lost on page refresh — that's intentional.
//     On refresh, hydrateFromCookie() restores the player record but not
//     the raw token. API routes keep working via cookie. The SurrealProvider
//     will connect without a token and fall back to server-side queries for
//     that session.
//
// ── Usage ──────────────────────────────────────────────────────────────────
//
//   Anywhere in the tree:
//     const { player, isLoading, signin, signout } = useAuth();
//
//   Or use the store directly:
//     import { auth, authToken, currentPlayer } from "~/lib/auth-store";

import {
    createContext,
    createEffect,
    JSX,
    onMount,
    useContext,
    type Accessor,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
    auth,
    hydrateFromCookie,
    signin as storeSignin,
    signup as storeSignup,
    signout as storeSignout,
    setFromToken as storeSetFromToken,
    isAuthenticated,
    currentPlayer,
    authToken,
    type Player,
} from "./auth-store";

// ── Context interface ──────────────────────────────────────────────────────

interface AuthContextValue {
    player: Accessor<Player | null>;
    token: Accessor<string | null>;
    isAuthenticated: Accessor<boolean>;
    isLoading: Accessor<boolean>;
    error: Accessor<string | null>;
    signin: (params: { identifier: string; password: string }) => Promise<void>;
    signup: (params: {
        username: string;
        email: string;
        password: string;
        display_name?: string;
    }) => Promise<void>;
    signout: () => Promise<void>;
    setFromToken: (token: string, player: Player) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>();

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider(props: { children: JSX.Element }) {
    // Hydrate from cookie on first load — restores player record if cookie
    // is still valid, without needing the raw token
    onMount(async () => {
        await hydrateFromCookie();
    });

    const value: AuthContextValue = {
        player: () => auth.player,
        token: () => auth.token,
        isAuthenticated: () => isAuthenticated(),
        isLoading: () => auth.isLoading,
        error: () => auth.error,
        signin: storeSignin,
        signup: storeSignup,
        signout: storeSignout,
        setFromToken: storeSetFromToken,
    };

    return (
        <AuthContext.Provider value={value}>
            {props.children}
        </AuthContext.Provider>
    );
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
    return ctx;
}

// ── useRequireAuth ──────────────────────────────────────────────────────────
// Drop into any page that requires a logged-in user.
// Redirects to / if the auth check fails after hydration completes.
//
// Usage:
//   export default function ProtectedPage() {
//     const player = useRequireAuth();  // redirects if not authed
//     return <div>Hello {player().display_name}</div>;
//   }

export function useRequireAuth(redirectTo = "/"): Accessor<Player | null> {
    const navigate = useNavigate();
    const { player, isLoading } = useAuth();

    createEffect(() => {
        // Wait until hydration is done before deciding to redirect
        if (!isLoading() && !player()) {
            navigate(redirectTo, { replace: true });
        }
    });

    return player;
}