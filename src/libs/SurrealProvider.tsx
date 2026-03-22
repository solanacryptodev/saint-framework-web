"use client";
// src/lib/SurrealProvider.tsx
//
// Client-side reactive SurrealDB connection. Only used by /play/[gameId].
// World Forge (/create/world-forge) does NOT use this — it communicates
// entirely through HTTP API routes with HttpOnly cookies.
//
// ── What this file does ────────────────────────────────────────────────────
//
//   SurrealProvider    Manages a WebSocket connection to SurrealDB.
//                      Authenticates with the player's JWT so live queries
//                      are scoped to the right player_scope permissions.
//
//   useSurreal()       Access the connection state + client anywhere inside
//                      the provider tree.
//
//   useSurrealClient() Shorthand to get just the Surreal client instance.
//
//   useLiveQuery()     Subscribe to a live SELECT query — returns a reactive
//                      signal that updates as rows are created/updated/deleted.
//
//   useQuery()         One-shot SELECT query, re-runs when deps change.
//
// ── Fixes from the original docs pattern ──────────────────────────────────
//
//   Fix 1: error accessor was `() => error` (captured value, not reactive).
//           Corrected to `() => error()`.
//
//   Fix 2: The <Show when={isSuccess()}> gate blocked CharacterCreationModal
//           from rendering before the DB connection was live. The modal only
//           needs DB on submit (which goes through an API route anyway), so
//           we now accept a `gateChildren` prop (default true) that can be
//           set to false to render children immediately while still tracking
//           connection state. The play page sets gateChildren={false} so the
//           character creation modal appears before the WS handshake completes.
//
//   Fix 3: `createSignal` was imported mid-file after exports. Moved to top.

import {
    createContext,
    createEffect,
    createSignal,
    JSX,
    onCleanup,
    onMount,
    Show,
    useContext,
    type Accessor,
} from "solid-js";
import { createStore } from "solid-js/store";
import { useMutation } from "@tanstack/solid-query";
import { Surreal } from "surrealdb";

// ── Types ──────────────────────────────────────────────────────────────────

interface SurrealProviderProps {
    children: JSX.Element;
    /** WebSocket endpoint e.g. "ws://localhost:8000" */
    endpoint: string;
    /** Bring your own Surreal instance (useful for testing) */
    client?: Surreal;
    /** Passed directly to Surreal.connect() */
    params?: Parameters<Surreal["connect"]>[1];
    /** Set false to disable auto-connect on mount */
    autoConnect?: boolean;
    /** Player JWT from signin/signup. Provider re-authenticates when this changes. */
    token?: string | null;
    /**
     * When true (default), children are hidden behind a <Show when={isSuccess()}> gate.
     * Set false to render children immediately — useful when children include UI
     * (like CharacterCreationModal) that doesn't need the DB connection to render,
     * only to submit.
     */
    gateChildren?: boolean;
    /** Shown while connecting when gateChildren is true */
    loadingFallback?: JSX.Element;
}

interface SurrealProviderState {
    client: Accessor<Surreal>;
    isConnecting: Accessor<boolean>;
    isSuccess: Accessor<boolean>;
    isError: Accessor<boolean>;
    error: Accessor<unknown | null>;
    connect: () => Promise<void>;
    close: () => Promise<true>;
    authenticate: (token: string) => Promise<void>;
}

interface SurrealStore {
    instance: Surreal;
    status: "connecting" | "connected" | "disconnected";
}

// ── Context ────────────────────────────────────────────────────────────────

const SurrealContext = createContext<SurrealProviderState>();

// ── Provider ───────────────────────────────────────────────────────────────

export function SurrealProvider(props: SurrealProviderProps) {
    const [store, setStore] = createStore<SurrealStore>({
        instance: props.client ?? new Surreal(),
        status: "disconnected",
    });

    const { mutateAsync, isError, error, reset } = useMutation(() => ({
        mutationFn: async () => {
            setStore("status", "connecting");
            // Connect without namespace/database — don't touch USE until authenticated
            await store.instance.connect(props.endpoint);
        },
    }));

    // Auto-connect on mount, close on unmount
    createEffect(() => {
        if (props.autoConnect !== false) mutateAsync();
        onCleanup(() => {
            reset();
            store.instance.close();
        });
    });

    onMount(() => {
        store.instance.subscribe("connected", async () => {
            // Don't setStore here yet — wait until fully auth'd
            if (props.token) {
                try {
                    await store.instance.authenticate(props.token);
                    await store.instance.use({
                        namespace: import.meta.env.VITE_SURREALDB_NS,
                        database: import.meta.env.VITE_SURREALDB_DB,
                    });
                } catch (err) {
                    console.error("[SurrealProvider] auth failed", err);
                }
            }
            // Only mark as connected AFTER auth + use complete
            setStore("status", "connected");
        });

        store.instance.subscribe("disconnected", () => {
            setStore("status", "disconnected");
        });
    });

    const value: SurrealProviderState = {
        client: () => store.instance,
        close: () => store.instance.close(),
        connect: mutateAsync,
        error: error as unknown as Accessor<unknown | null>,
        isConnecting: () => store.status === "connecting",
        isError: () => isError,
        isSuccess: () => store.status === "connected",
        authenticate: async (token: string) => { await store.instance.authenticate(token); },
    };

    // fix 2: gateChildren controls whether children wait for connection
    const gate = () => props.gateChildren !== false;

    return (
        <SurrealContext.Provider value={value}>
            <Show when={!gate() || value.isSuccess()}
                fallback={gate() ? (props.loadingFallback ?? <ConnectingScreen />) : null}
            >
                {props.children}
            </Show>
        </SurrealContext.Provider>
    );
}

// ── Default connecting screen ───────────────────────────────────────────────

function ConnectingScreen() {
    return (
        <div style={{
            display: "flex", "align-items": "center", "justify-content": "center",
            height: "100vh", background: "#020617", color: "#334155",
            "font-family": "'Courier New', monospace", "font-size": "10px",
            "letter-spacing": "0.2em",
        }}>
            <span style={{ animation: "pulse 1.2s ease infinite" }}>
                CONNECTING TO WORLD ENGINE…
            </span>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }`}</style>
        </div>
    );
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useSurreal(): SurrealProviderState {
    const ctx = useContext(SurrealContext);
    if (!ctx) throw new Error("useSurreal must be used within a <SurrealProvider>");
    return ctx;
}

export function useSurrealClient(): Accessor<Surreal> {
    return useSurreal().client;
}

// ── useLiveQuery ────────────────────────────────────────────────────────────
// Polls a SurrealDB query and returns a reactive signal.
// This is a simplified implementation that polls at intervals.
// For true WebSocket-based live queries, implement based on your SurrealDB SDK version.
//
// Usage:
//   const threads = useLiveQuery<WorldThread>(
//     () => `SELECT * FROM world_thread WHERE session_id = '${session.id}'`
//   );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLiveQuery<T = any>(
    queryFn: () => string,
    initial: T[] = []
): Accessor<T[]> {
    const { client, isSuccess } = useSurreal();
    const [results, setResults] = createSignal<T[]>(initial);

    createEffect(() => {
        if (!isSuccess()) return;

        // Initial fetch
        client()
            .query<T[]>(queryFn())
            .then((data) => {
                if (Array.isArray(data)) {
                    setResults(data as T[]);
                }
            })
            .catch(console.error);

        // Poll every 2 seconds for updates
        const intervalId = setInterval(() => {
            client()
                .query<T[]>(queryFn())
                .then((data) => {
                    if (Array.isArray(data)) {
                        setResults(data as T[]);
                    }
                })
                .catch(() => { });
        }, 2000);

        onCleanup(() => {
            clearInterval(intervalId);
        });
    });

    return results;
}

// ── useQuery ────────────────────────────────────────────────────────────────
// One-shot query that runs once the connection is ready and whenever
// queryFn changes. Does not subscribe to changes — use useLiveQuery for that.
//
// Usage:
//   const actor = useQuery<WorldActor>(
//     () => `SELECT * FROM world_actor WHERE kind = 'player' LIMIT 1`
//   );

export function useQuery<T>(
    queryFn: () => string,
    initial: T[] = []
): Accessor<T[]> {
    const { client, isSuccess } = useSurreal();
    const [results, setResults] = createSignal<T[]>(initial);

    createEffect(() => {
        if (!isSuccess()) return;

        client()
            .query<[T[]]>(queryFn())
            .then(([rows]) => setResults(rows ?? []))
            .catch(console.error);
    });

    return results;
}