"use client";

// src/components/world-forge/ForgeContext.tsx
//
// Shared state for the World Forge pipeline.
// Mounted once in src/routes/create.tsx (the layout) so state
// survives the navigation from /create → /create/forge.
//
// ── What lives here ────────────────────────────────────────────────────────
//
//   Upload fields:  worldName, worldTagline, coverImage
//                   These three are set in /create before startForge runs.
//                   Everything else (description, genre, cost_tier, cost)
//                   comes from ## Game Info in the lore bible — parsed by
//                   the ingestion agent and patched onto the game record
//                   automatically. No reason to ask for them upfront.
//
//   Pipeline state: stage, forgePhase, progress, statusMsg, logLines
//   Graph results:  entities, warnings
//   Manifest state: editingId, kindFilter, launching

import {
    createContext,
    useContext,
    createSignal,
    type ParentComponent,
} from "solid-js";
import { useNavigate } from "@solidjs/router";

// ── Types ──────────────────────────────────────────────────────────────────

type Stage = "upload" | "forging" | "manifest" | "launched";
type ForgePhase = "parse" | "lore" | "world" | "complete";

export interface EntityCard {
    surreal_id: string;
    name: string;
    kind: string;
    description: string;
    properties: Record<string, unknown>;
    image: string | null;
    edited: boolean;
}

interface LogLine {
    id: number;
    text: string;
    color: string;
}

interface ForgeContextType {
    // Upload fields
    stage: () => Stage;
    gameId: () => string | null;
    worldName: () => string;
    worldTagline: () => string;
    coverImage: () => string | null;       // base64 or object URL
    uploadError: () => string | null;

    // Pipeline state
    forgePhase: () => ForgePhase;
    progress: () => number;
    statusMsg: () => string;
    logLines: () => LogLine[];

    // Graph results
    entities: () => EntityCard[];
    warnings: () => string[];

    // Manifest state
    editingId: () => string | null;
    kindFilter: () => string;
    launching: () => boolean;

    // Setters
    setStage: (s: Stage) => void;
    setGameId: (id: string | null) => void;
    setWorldName: (n: string) => void;
    setWorldTagline: (t: string) => void;
    setCoverImage: (img: string | null) => void;
    setUploadError: (e: string | null) => void;
    setForgePhase: (p: ForgePhase) => void;
    setProgress: (n: number) => void;
    setStatusMsg: (m: string) => void;
    setLogLines: (l: LogLine[] | ((prev: LogLine[]) => LogLine[])) => void;
    setEntities: (e: EntityCard[] | ((prev: EntityCard[]) => EntityCard[])) => void;
    setWarnings: (w: string[]) => void;
    setEditingId: (id: string | null) => void;
    setKindFilter: (f: string) => void;
    setLaunching: (b: boolean) => void;

    // Actions
    startForge: (file: File) => Promise<void>;
    addLog: (text: string, color?: string) => void;
    handleLaunch: () => Promise<void>;

    // Computed
    filteredEntities: () => EntityCard[];
    kindCounts: () => Record<string, number>;
    phaseIndex: () => number;
}

// ── Context ────────────────────────────────────────────────────────────────

const ForgeContext = createContext<ForgeContextType>();

export function useForge(): ForgeContextType {
    const ctx = useContext(ForgeContext);
    if (!ctx) throw new Error("useForge must be used within a ForgeProvider");
    return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────

export const ForgeProvider: ParentComponent = (props) => {
    const navigate = useNavigate();

    // ── State ────────────────────────────────────────────────────────────────
    const [stage, setStage] = createSignal<Stage>("upload");
    const [gameId, setGameId] = createSignal<string | null>(null);
    const [worldName, setWorldName] = createSignal("My World");
    const [worldTagline, setWorldTagline] = createSignal("");
    const [coverImage, setCoverImage] = createSignal<string | null>(null);
    const [uploadError, setUploadError] = createSignal<string | null>(null);
    const [forgePhase, setForgePhase] = createSignal<ForgePhase>("parse");
    const [progress, setProgress] = createSignal(0);
    const [statusMsg, setStatusMsg] = createSignal("");
    const [logLines, setLogLines] = createSignal<LogLine[]>([]);
    const [entities, setEntities] = createSignal<EntityCard[]>([]);
    const [warnings, setWarnings] = createSignal<string[]>([]);
    const [editingId, setEditingId] = createSignal<string | null>(null);
    const [kindFilter, setKindFilter] = createSignal("all");
    const [launching, setLaunching] = createSignal(false);

    // ── Helpers ──────────────────────────────────────────────────────────────

    function addLog(text: string, color = "#64748b") {
        setLogLines(l => [...l.slice(-50), { id: Date.now() + Math.random(), text, color }]);
    }

    function phaseColor(phase: string): string {
        return {
            parse: "#94a3b8",
            lore: "#c084fc",
            world: "#34d399",
            validating: "#fbbf24",
            complete: "#34d399",
        }[phase] ?? "#64748b";
    }

    // ── startForge ───────────────────────────────────────────────────────────
    // Called from /create when the user drops a lore bible.
    // Creates the game record, navigates to /create/forge, then streams ingestion.
    //
    // Only worldName, worldTagline, and coverImage are sent upfront — everything
    // else (description, genre, cost_tier, cost) comes from ## Game Info in the
    // lore bible and is patched onto the game record by ingest.ts automatically.

    const startForge = async (file: File) => {
        setUploadError(null);

        // Create the game record
        const createRes = await fetch("/api/games", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                name: worldName(),
                tagline: worldTagline(),
                cover_image: coverImage() ?? undefined,
                sourceFile: file.name,
            }),
        });

        if (!createRes.ok) {
            const d = await createRes.json();
            setUploadError(d.error ?? "Failed to create game record");
            return;
        }

        const { game } = await createRes.json();
        setGameId(game.id);
        setStage("forging");

        // Navigate to the forge page before starting the stream
        navigate("/create/forge");

        // ── Periodic DB poll — updates entity cards in real time ──────────────
        // The agents write directly to the DB via tools. The SSE stream only
        // emits progress messages, not individual entity writes. So we poll
        // the lore_node table every 3 seconds to show cards crystallizing.
        let pollActive = true;
        const poll = async () => {
            while (pollActive) {
                try {
                    const res = await fetch("/api/lore?limit=200", { credentials: "include" });
                    if (res.ok) {
                        const data = await res.json();
                        const incoming: EntityCard[] = (data.nodes ?? []).map((n: any) => ({
                            surreal_id: String(n.id),
                            name: n.name,
                            kind: n.kind,
                            description: n.description ?? "",
                            properties: n.properties ?? {},
                            image: null,
                            edited: false,
                        }));
                        if (incoming.length > 0) setEntities(incoming);
                    }
                } catch { /* ignore poll errors */ }
                await new Promise(r => setTimeout(r, 3000));
            }
        };
        poll();

        // Stream ingestion via SSE
        const formData = new FormData();
        formData.append("loreBible", file);
        formData.append("gameId", game.id);

        const response = await fetch("/api/lore/ingest", {
            method: "POST",
            body: formData,
            credentials: "include",
        });

        if (!response.ok || !response.body) {
            setUploadError(`Ingestion failed: ${response.statusText}`);
            setStage("upload");
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
                if (!part.startsWith("data: ")) continue;
                try {
                    const event = JSON.parse(part.slice(6));

                    if (event.type === "progress") {
                        const phaseMap: Record<string, ForgePhase> = {
                            chunking: "parse",
                            extracting: "lore",
                            validating: "lore",
                            world_init: "world",
                            complete: "complete",
                        };
                        setForgePhase((phaseMap[event.phase] ?? "parse") as ForgePhase);
                        setProgress(event.percent);
                        setStatusMsg(event.message);
                        addLog(event.message, phaseColor(event.phase));

                    } else if (event.type === "complete") {
                        pollActive = false;  // stop polling — we have final data
                        // Fetch full node data from DB to get descriptions
                        try {
                            const res = await fetch("/api/lore?limit=500", { credentials: "include" });
                            if (res.ok) {
                                const data = await res.json();
                                const cards: EntityCard[] = (data.nodes ?? []).map((n: any) => ({
                                    surreal_id: String(n.id),
                                    name: n.name,
                                    kind: n.kind,
                                    description: n.description ?? "",
                                    properties: n.properties ?? {},
                                    image: null,
                                    edited: false,
                                }));
                                if (cards.length > 0) setEntities(cards);
                            }
                        } catch {
                            // Fall back to report data if fetch fails
                            const report = event.report;
                            const cards: EntityCard[] = (report.nodesWritten ?? []).map((n: any) => ({
                                surreal_id: n.surreal_id,
                                name: n.name,
                                kind: n.kind,
                                description: "",
                                properties: {},
                                image: null,
                                edited: false,
                            }));
                            setEntities(cards);
                        }
                        setWarnings(event.report.warnings ?? []);
                        setProgress(100);
                        addLog("✓ World initialized — reviewing manifest…", "#34d399");
                        setTimeout(() => setStage("manifest"), 800);

                    } else if (event.type === "error") {
                        pollActive = false;
                        addLog(`✗ ${event.message}`, "#f87171");
                        setStage("upload");
                    }
                } catch { /* skip malformed SSE frames */ }
            }
        }
    };

    // ── handleLaunch ─────────────────────────────────────────────────────────
    // Sets game status to "ready" then navigates to the play route.
    // Uses slug-based URL so it matches /play/game/[gameTitle]/play.

    const handleLaunch = async () => {
        const id = gameId();
        if (!id) return;
        setLaunching(true);

        await fetch(`/api/games/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: "ready" }),
        });

        setStage("launched");

        setTimeout(() => {
            navigate("/play");
        }, 2000);
    };

    // ── Computed ──────────────────────────────────────────────────────────────

    const filteredEntities = () =>
        kindFilter() === "all"
            ? entities()
            : entities().filter(e => e.kind === kindFilter());

    const kindCounts = () => {
        const counts: Record<string, number> = {};
        entities().forEach(e => { counts[e.kind] = (counts[e.kind] ?? 0) + 1; });
        return counts;
    };

    const phaseIndex = () =>
        ["parse", "lore", "world", "complete"].indexOf(forgePhase());

    // ── Context value ─────────────────────────────────────────────────────────

    const value: ForgeContextType = {
        stage, gameId, worldName, worldTagline, coverImage, uploadError,
        forgePhase, progress, statusMsg, logLines,
        entities, warnings, editingId, kindFilter, launching,
        setStage, setGameId, setWorldName, setWorldTagline, setCoverImage,
        setUploadError, setForgePhase, setProgress, setStatusMsg, setLogLines,
        setEntities, setWarnings, setEditingId, setKindFilter, setLaunching,
        startForge, addLog, handleLaunch,
        filteredEntities, kindCounts, phaseIndex,
    };

    return (
        <ForgeContext.Provider value={value}>
            {props.children}
        </ForgeContext.Provider>
    );
};