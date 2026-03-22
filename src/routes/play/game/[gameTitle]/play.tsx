"use client";
// src/routes/play/game/[gameTitle]/play.tsx
//
// The game route. Resolves gameId, opens the SurrealDB WebSocket connection,
// guards auth, then renders GeneralGame.
//
// gameId resolves two ways:
//   1. Via location state from GameDetail (normal nav flow — no extra fetch)
//   2. Via slug lookup against /api/games/by-slug/:slug (direct/bookmarked link)
//
// SurrealProvider lives here, not inside GeneralGame. One WS connection per
// game session. gateChildren=false so GeneralGame renders immediately while
// the WS handshake completes in the background.

import { createResource, Show } from "solid-js";
import { useParams, useNavigate, useLocation } from "@solidjs/router";
import { useAuth, useRequireAuth } from "~/libs/AuthProvider";
import { SurrealProvider } from "~/libs/SurrealProvider";
import GeneralGame from "~/components/games/GeneralGame";

export default function GamePlayPage() {
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = useAuth();

    // Auth guard — redirects to /signin if not logged in
    useRequireAuth();

    // ── Resolve gameId ──────────────────────────────────────────────────────
    // Happy path: gameId in location.state, set by GameDetail before navigating
    // Fallback:   slug lookup via API for direct/bookmarked links

    const stateGameId = (location.state as any)?.gameId as string | undefined;

    const [gameId] = createResource(
        () => stateGameId ?? params.gameTitle,
        async (slugOrId) => {
            if (stateGameId) return stateGameId;
            const res = await fetch(`/api/games/by-slug/${slugOrId}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data.game?.id ?? null;
        }
    );

    const handleBack = () => {
        navigate(`/play/game/${params.gameTitle}`);
    };

    return (
        <Show when={!gameId.loading} fallback={<LoadingScreen />}>
            <Show when={gameId()} fallback={<ErrorScreen onBack={handleBack} />}>
                <SurrealProvider
                    endpoint={import.meta.env.VITE_SURREALDB_URL ?? "ws://localhost:8000/rpc"}
                    token={token()}
                    gateChildren={false}
                >
                    <GeneralGame
                        gameId={gameId()!}
                        onBack={handleBack}
                    />
                </SurrealProvider>
            </Show>
        </Show>
    );
}

// ── Utility screens ─────────────────────────────────────────────────────────

function LoadingScreen() {
    return (
        <div style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "min-height": "100vh",
            background: "#080c14",
            color: "#334155",
            "font-family": "'Courier New', monospace",
            "font-size": "11px",
            "letter-spacing": "0.2em",
        }}>
            <span style={{ animation: "pulse 1.2s ease infinite" }}>
                ENTERING WORLD…
            </span>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
        </div>
    );
}

function ErrorScreen(props: { onBack: () => void }) {
    return (
        <div style={{
            display: "flex",
            "flex-direction": "column",
            "align-items": "center",
            "justify-content": "center",
            "min-height": "100vh",
            gap: "1.5rem",
            background: "#080c14",
        }}>
            <div style={{ "text-align": "center" }}>
                <div style={{ color: "#475569", "font-size": "2.5rem", "margin-bottom": "1rem" }}>◈</div>
                <div style={{ color: "#f1f5f9", "font-weight": "600", "font-size": "1.1rem", "margin-bottom": "0.5rem" }}>
                    World unavailable
                </div>
                <div style={{ color: "#475569", "font-size": "0.875rem" }}>
                    This game hasn't been initialized yet or is no longer available.
                </div>
            </div>
            <button
                onClick={props.onBack}
                style={{
                    color: "#eab308",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    "font-size": "0.875rem",
                }}
            >
                ← Back to game details
            </button>
        </div>
    );
}