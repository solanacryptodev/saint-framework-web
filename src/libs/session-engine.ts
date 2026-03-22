"use server";

// src/lib/session-engine.ts
//
// Per-game ACE Engine initialization.
//
// The ACEEngine is configured from the game record — genre drives tone,
// cost_tier drives model quality, visibility affects phase thresholds.
// One engine instance is built per active session and cached in memory.
// Sessions that go idle get evicted from the cache.
//
// Merge point with ace-engine.ts:
//   startSession() returns { session, engine }
//   The API route stores the engine in SESSION_CACHE keyed by sessionId.
//   Every subsequent turn call looks up the engine and calls engine.runTurn().

import { getDB } from "./surreal";
import { getGame } from "./game";
import { SaintEngine } from "../agentic/game/saint-engine";
import type { GameSession, GameRecord } from "./types";
import { Table } from "surrealdb";

// ── Types ──────────────────────────────────────────────────────────────────

export type GenreTone =
    | "thriller"
    | "southern_gothic"
    | "science_fiction"
    | "fantasy"
    | "horror";

type ModelPair = { power: string; fast: string };

// ── Genre → Engine tone mapping ───────────────────────────────────────────
// Free-text genre field from the lore bible's ## Game Info section.
// Normalized to one of five supported tones. Unknown genres → "fantasy".

const GENRE_TONE_MAP: Record<string, GenreTone> = {
    "thriller": "thriller",
    "spy": "thriller",
    "conspiracy": "thriller",
    "espionage": "thriller",
    "noir": "thriller",
    "horror": "horror",
    "gothic": "southern_gothic",
    "southern gothic": "southern_gothic",
    "vampire": "southern_gothic",
    "dark fantasy": "southern_gothic",
    "sci-fi": "science_fiction",
    "science fiction": "science_fiction",
    "space opera": "science_fiction",
    "cyberpunk": "science_fiction",
    "post-apocalyptic": "science_fiction",
    "fantasy": "fantasy",
    "epic fantasy": "fantasy",
    "adventure": "fantasy",
};

export function resolveGenreTone(genre: string): GenreTone {
    const normalized = genre.toLowerCase().trim();
    if (normalized in GENRE_TONE_MAP) return GENRE_TONE_MAP[normalized];
    for (const [key, tone] of Object.entries(GENRE_TONE_MAP)) {
        if (normalized.includes(key)) return tone;
    }
    return "fantasy";
}

// ── Cost tier → Model pair ─────────────────────────────────────────────────
// power = Witness + Prose Agent (player-facing, quality matters)
// fast  = Tremor + Eternal + NPC agents (DB operators, speed matters)

function resolveModels(costTier: GameRecord["cost_tier"]): ModelPair {
    switch (costTier) {
        case "premium":
        case "paid":
            return {
                power: "anthropic/claude-haiku-4-5",
                fast: "anthropic/claude-haiku-4-5",
            };
        case "free":
        default:
            return {
                power: "anthropic/claude-haiku-4-5",
                fast: "anthropic/claude-haiku-4-5",
            };
    }
}

// ── Phase thresholds by genre ──────────────────────────────────────────────
// Controls how quickly story_progress accumulates toward the next phase.
// Low threshold = phase advances quickly. High threshold = slow burn.

function resolvePhaseThresholds(tone: GenreTone): Record<string, number> {
    switch (tone) {
        case "thriller":
            return {
                ordinary_world: 0.3,
                call_to_adventure: 0.5,
                crossing_threshold: 0.7,
                refusal_of_the_call: 0.75,
                meeting_the_mentor: 0.8,
                belly_of_the_whale: 0.82,
                tests_allies_and_enemies: 0.85,
                ordeal: 0.9,
                reward: 0.95,
                road_back: 0.97,
                resurrection: 0.99,
                return_with_elixir: 1.0,
            };
        case "southern_gothic":
            return {
                ordinary_world: 0.5,
                call_to_adventure: 0.65,
                descent: 0.8,
                reckoning: 0.9,
            };
        case "science_fiction":
            return {
                ordinary_world: 0.35,
                inciting_incident: 0.5,
                escalation: 0.7,
                climax: 0.88,
                resolution: 0.96,
            };
        case "horror":
            return {
                ordinary_world: 0.4,
                dread: 0.55,
                confrontation: 0.75,
                survival: 0.9,
            };
        case "fantasy":
        default:
            return {
                ordinary_world: 0.4,
                call_to_adventure: 0.55,
                crossing_threshold: 0.7,
                ordeal: 0.85,
                return_with_elixir: 0.95,
            };
    }
}

// ── Eternal significance threshold by genre ───────────────────────────────
// Min significance score before the Tremor notifies the Eternal.
// High = hard to earn canon. Low = legend forms quickly.

function resolveEternalThreshold(tone: GenreTone): number {
    switch (tone) {
        case "thriller": return 0.70;
        case "southern_gothic": return 0.50;
        case "science_fiction": return 0.65;
        case "horror": return 0.55;
        case "fantasy":
        default: return 0.60;
    }
}

// ── Engine builder ─────────────────────────────────────────────────────────
// Maps game record fields → fully configured ACEEngine instance.
// This is the only place where game metadata touches the engine config.

export function buildEngineForGame(game: GameRecord): SaintEngine {
    const tone = resolveGenreTone(game.genre);
    const models = resolveModels(game.cost_tier);
    const thresholds = resolvePhaseThresholds(tone);
    const eternal = resolveEternalThreshold(tone);

    return SaintEngine
        .builder()
        .powerModel(models.power)
        .fastModel(models.fast)
        .genre(tone)
        .eternalThreshold(eternal)
        .maxSteps(12, 12, 12)
        .phaseThresholds(thresholds)
        .build();
}

// ── Session cache ──────────────────────────────────────────────────────────
// Engines are stateless — all mutable state lives in SurrealDB.
// The cache holds only the configured ACEEngine instance and the
// lightweight GameSession object. Evicted after 30 min of inactivity.
// On eviction, resumeSession() rebuilds from the DB with no state loss.

interface CachedSession {
    engine: SaintEngine;
    session: GameSession;
    lastAccessedAt: number;
}

const SESSION_CACHE = new Map<string, CachedSession>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function evictStaleSessions() {
    const now = Date.now();
    for (const [id, entry] of SESSION_CACHE.entries()) {
        if (now - entry.lastAccessedAt > SESSION_TTL_MS) {
            SESSION_CACHE.delete(id);
        }
    }
}

export function getEngineFromCache(sessionId: string): SaintEngine | null {
    const cached = SESSION_CACHE.get(sessionId);
    if (!cached) return null;
    cached.lastAccessedAt = Date.now();
    return cached.engine;
}

// ── Session start ──────────────────────────────────────────────────────────
// Called once when a player enters a game for the first time.
// Creates all per-session DB records and returns the live engine.

export async function startSession(
    gameId: string,
    playerId: string,
    playerCharacterId: string
): Promise<{ session: GameSession; engine: SaintEngine }> {
    evictStaleSessions();

    const db = await getDB();
    const game = await getGame(gameId);

    if (!game) throw new Error(`Game not found: ${gameId}`);
    if (game.status !== "ready") throw new Error(`Game ${gameId} not ready (status: ${game.status})`);

    const engine = buildEngineForGame(game);
    const sessionId = `session:${crypto.randomUUID()}`;
    const tone = resolveGenreTone(game.genre);

    const session: GameSession = {
        sessionId,
        playerId,
        startedAt: new Date().toISOString(),
        turnNumber: 0,
        narrativeThreads: [],
        choiceHistory: [],
    };

    // Persist the session record
    await db.create(new Table("game_session")).content({
        session_id: sessionId,
        game_id: gameId,
        player_id: playerId,
        player_character_id: playerCharacterId,
        turn_number: 0,
        narrative_threads: [],
        choice_history: [],
        engine_genre: tone,
        engine_cost_tier: game.cost_tier,
        started_at: session.startedAt,
        last_active_at: session.startedAt,
    });

    // Copy WORLD_INIT world graph records into this player's session scope
    await copyWorldInitToSession(sessionId, gameId);

    // Seed player influence vectors at neutral start state
    await db.create(new Table("player_session")).content({
        session_id: sessionId,
        game_id: gameId,
        player_id: playerId,
        moral_stance: 0.0,
        approach: 0.0,
        scale: 0.5,
        foresight: 0,
        pull_on_world: [0.0, 0.0, 0.0],
        idea_amplification: {},
        stability_effect: 0.0,
    });

    // Seed narrative gravity system at rest state
    const initialPhase = Object.keys(resolvePhaseThresholds(tone))[0];
    await db.create(new Table("narrative_state")).content({
        session_id: sessionId,
        game_id: gameId,
        current_phase: initialPhase,
        phase_charge: 0.0,
        narrative_entropy: 0.0,
        archetype_cohesion: 0.8,
        player_resonance: 0.0,
        inertia_resistance: 0.5,
        point_of_no_return: 0.0,
        pull_conflict: 0.0,
        story_pace: 1.0,
        breaking_point: 0.0,
        event_distortion: 0.0,
        world_awareness: 0.0,
    });

    SESSION_CACHE.set(sessionId, { engine, session, lastAccessedAt: Date.now() });

    console.log(`[ACE] Session started: ${sessionId} | ${game.name} | ${game.genre} | ${game.cost_tier}`);

    return { session, engine };
}

// ── Session resume ─────────────────────────────────────────────────────────
// Called when a returning player re-enters a game.
// Checks memory cache first, rebuilds from DB if evicted.

export async function resumeSession(
    sessionId: string
): Promise<{ session: GameSession; engine: SaintEngine } | null> {
    evictStaleSessions();

    const cached = SESSION_CACHE.get(sessionId);
    if (cached) {
        cached.lastAccessedAt = Date.now();
        return { session: cached.session, engine: cached.engine };
    }

    const db = await getDB();
    const [rows] = await db.query<[any[]]>(
        `SELECT * FROM game_session WHERE session_id = $sid LIMIT 1`,
        { sid: sessionId }
    );
    const record = rows?.[0];
    if (!record) return null;

    const game = await getGame(record.game_id);
    if (!game) return null;

    const engine: SaintEngine = buildEngineForGame(game);
    const session: GameSession = {
        sessionId: record.session_id,
        playerId: record.player_id,
        startedAt: record.started_at,
        turnNumber: record.turn_number ?? 0,
        narrativeThreads: record.narrative_threads ?? [],
        choiceHistory: record.choice_history ?? [],
    };

    SESSION_CACHE.set(sessionId, { engine, session, lastAccessedAt: Date.now() });

    // Touch last_active_at in DB
    await db.query(
        `UPDATE game_session SET last_active_at = time::now() WHERE session_id = $sid`,
        { sid: sessionId }
    );

    return { session, engine };
}

// ── World init copy ────────────────────────────────────────────────────────
// Copies WORLD_INIT records (session_id = 'WORLD_INIT') into the player's
// session scope. Each copied record gets:
//   - A new SurrealDB-assigned ID
//   - session_id = the player's session ID
//   - original_id = the WORLD_INIT record's ID (for reference)
//
// Tables copied: world_agent, world_location, world_item,
//                world_faction, world_concept, world_thread
//
// NOT copied: lore_node, lore_relation (shared read-only across all sessions)
//             world_event (starts empty — generated during play)

async function copyTable(
    db: Awaited<ReturnType<typeof getDB>>,
    table: string,
    sessionId: string,
    gameId: string,
    extraWhere?: string
): Promise<void> {
    const where = extraWhere
        ? `game_id = $gid AND ${extraWhere}`
        : `game_id = $gid`;

    const [records] = await db.query<[any[]]>(
        `SELECT * FROM type::table($t) WHERE ${where}`,
        { t: table, gid: gameId }
    );

    if (!records?.length) return;

    // Copy all records in this table concurrently
    await Promise.all(
        records.map(({ id, ...rest }) =>
            db.create(new Table(table)).content({
                ...rest,
                session_id: sessionId,
                original_id: String(id),
            })
        )
    );

    console.log(`[ACE] Copied ${records.length} ${table} records → session ${sessionId}`);
}

async function copyWorldInitToSession(sessionId: string, gameId: string) {
    const db = await getDB();

    await Promise.all([
        copyTable(db, "world_agent", sessionId, gameId, `session_id = 'WORLD_INIT'`),
        copyTable(db, "world_location", sessionId, gameId, `session_id = 'WORLD_INIT'`),
        copyTable(db, "world_item", sessionId, gameId, `session_id = 'WORLD_INIT'`),
        copyTable(db, "world_faction", sessionId, gameId, `session_id = 'WORLD_INIT'`),
        copyTable(db, "world_concept", sessionId, gameId, `session_id = 'WORLD_INIT'`),
        copyTable(db, "world_thread", sessionId, gameId, `session_id = 'WORLD_INIT'`),
    ]);

    console.log(`[ACE] World init fully copied → session ${sessionId}`);
}