"use server";
// src/lib/surreal.ts
//
// Server-only SurrealDB client — root connection used by all Mastra agents
// and API routes. Never imported by client-side code.
//
// ── Connection model ──────────────────────────────────────────────────────
//
//   getDB()  →  root connection (admin)
//               Used by: agents, API routes, schema boot
//               Credentials: root/root (from env)
//
//   SurrealProvider (client)
//               Used by: /play/[gameId] page for live queries only
//               Credentials: player JWT (scope: player_scope)
//               See: src/lib/SurrealProvider.tsx
//
// ── Graph isolation model ─────────────────────────────────────────────────
//
//   Current: single namespace/database — one lore graph per DB instance.
//   The Saint Framework runs one game world per deployment. If multi-world
//   is ever needed, add game_id columns to lore_node, world_actor,
//   world_location, and world_item and filter everywhere.
//
// ── Schema ownership ──────────────────────────────────────────────────────
//
//   surreal.ts         → Lore Graph + World Graph + ACE system tables
//   auth.ts            → player table + player_scope
//   game.ts            → game + entity_asset tables
//   player-character.ts→ player_character_template + player_character tables
//
// ── What was removed in this revision ────────────────────────────────────
//
//   world_init table   → superseded by game.status. Removed.
//   upsertWorldState() → legacy shim for old orchestrator. Removed.
//   getWorldInitStatus()→ callers should use getGame() from game.ts instead.

import { Surreal, Table, Values } from "surrealdb";
import { applyAuthSchema } from "./auth";

// ── Environment variable helper ─────────────────────────────────────────────
// Trims whitespace/newlines that can cause authentication failures

function getEnvVar(key: string, fallback?: string): string {
    const value = process.env[key];
    if (!value && fallback === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return (value ?? fallback!).trim();
}

// ── Singleton root connection ─────────────────────────────────────────────

let _db: Surreal | null = null;
let _schemaApplied = false;

export async function getDB(): Promise<Surreal> {
    if (_db) return _db;

    _db = new Surreal();

    await _db.connect(getEnvVar("SURREALDB_URL"), {
        namespace: getEnvVar("SURREALDB_NS"),
        database: getEnvVar("SURREALDB_DB"),
        authentication: {
            username: getEnvVar("SURREALDB_USERNAME"),
            password: getEnvVar("SURREALDB_PASSWORD"),
        },
    });
    if (!_schemaApplied) {
        await applySchema(_db);
        await applyAuthSchema(_db);
        _schemaApplied = true;
    }
    return _db;
}

// ── Schema ────────────────────────────────────────────────────────────────

async function applySchema(db: Surreal) {

    // ── LORE GRAPH ────────────────────────────────────────────────────────────
    // Written once during World Forge. Read-heavy during play.
    // lore_node and lore_relation are immutable after ingestion.
    // lore_event grows during play — one row per player decision.

    await db.query(`
    DEFINE TABLE IF NOT EXISTS lore_node SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS kind         ON lore_node TYPE string;
    DEFINE FIELD IF NOT EXISTS name         ON lore_node TYPE string;
    DEFINE FIELD IF NOT EXISTS description  ON lore_node TYPE string;
    DEFINE FIELD IF NOT EXISTS properties   ON lore_node TYPE object  DEFAULT {};
    DEFINE FIELD IF NOT EXISTS canon        ON lore_node TYPE bool    DEFAULT true;
    DEFINE FIELD IF NOT EXISTS created_at   ON lore_node TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updated_at   ON lore_node TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS lore_node_name ON lore_node COLUMNS name;

    DEFINE TABLE IF NOT EXISTS lore_relation
      TYPE RELATION FROM lore_node TO lore_node SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS relation_type ON lore_relation TYPE string;
    DEFINE FIELD IF NOT EXISTS weight        ON lore_relation TYPE float   DEFAULT 1.0;
    DEFINE FIELD IF NOT EXISTS established   ON lore_relation TYPE string  DEFAULT "pre-game";
    DEFINE FIELD IF NOT EXISTS metadata      ON lore_relation TYPE object  DEFAULT {};

    -- Append-only event log. Every player decision becomes permanent lore.
    DEFINE TABLE IF NOT EXISTS lore_event SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS session_id    ON lore_event TYPE string;
    DEFINE FIELD IF NOT EXISTS turn_number   ON lore_event TYPE int;
    DEFINE FIELD IF NOT EXISTS event_kind    ON lore_event TYPE string;
    DEFINE FIELD IF NOT EXISTS description   ON lore_event TYPE string;
    DEFINE FIELD IF NOT EXISTS actors        ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS locations     ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS items         ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS consequences  ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS player_choice ON lore_event TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS created_at    ON lore_event TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS lore_event_session ON lore_event COLUMNS session_id;
  `);

    // ── WORLD GRAPH ───────────────────────────────────────────────────────────
    // Written during World Forge init, mutated every turn during play.
    // This is the live simulation state the ACE agents read and write.

    await db.query(`
    -- Every character and NPC with live position + behavioral state
    DEFINE TABLE IF NOT EXISTS world_actor SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS lore_ref     ON world_actor TYPE string;
    DEFINE FIELD IF NOT EXISTS name         ON world_actor TYPE string;
    DEFINE FIELD IF NOT EXISTS kind         ON world_actor TYPE string; -- player|npc|faction_rep
    DEFINE FIELD IF NOT EXISTS location_id  ON world_actor TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS disposition  ON world_actor TYPE string DEFAULT "neutral";
    DEFINE FIELD IF NOT EXISTS awareness    ON world_actor TYPE string DEFAULT "unaware";
    DEFINE FIELD IF NOT EXISTS goal_current ON world_actor TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS goal_hidden  ON world_actor TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS state        ON world_actor TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS active       ON world_actor TYPE bool   DEFAULT true;
    DEFINE FIELD IF NOT EXISTS updated_at   ON world_actor TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS world_actor_name ON world_actor COLUMNS name;

    -- Every location with current danger level and unrevealed secrets
    DEFINE TABLE IF NOT EXISTS world_location SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS lore_ref          ON world_location TYPE string;
    DEFINE FIELD IF NOT EXISTS name              ON world_location TYPE string;
    DEFINE FIELD IF NOT EXISTS region            ON world_location TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS accessible        ON world_location TYPE bool   DEFAULT true;
    DEFINE FIELD IF NOT EXISTS danger_level      ON world_location TYPE float  DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS atmosphere        ON world_location TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS secrets           ON world_location TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS revealed_secrets  ON world_location TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS state             ON world_location TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS updated_at        ON world_location TYPE datetime DEFAULT time::now();

    -- Every item with current holder and player awareness
    DEFINE TABLE IF NOT EXISTS world_item SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS lore_ref         ON world_item TYPE string;
    DEFINE FIELD IF NOT EXISTS name             ON world_item TYPE string;
    DEFINE FIELD IF NOT EXISTS holder_actor     ON world_item TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS location_id      ON world_item TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS accessible       ON world_item TYPE bool   DEFAULT false;
    DEFINE FIELD IF NOT EXISTS known_to_player  ON world_item TYPE bool   DEFAULT false;
    DEFINE FIELD IF NOT EXISTS condition        ON world_item TYPE string DEFAULT "intact";
    DEFINE FIELD IF NOT EXISTS state            ON world_item TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS updated_at       ON world_item TYPE datetime DEFAULT time::now();

    -- Open narrative threads. Tension and urgency drift each turn.
    DEFINE TABLE IF NOT EXISTS world_thread SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS session_id         ON world_thread TYPE string;
    DEFINE FIELD IF NOT EXISTS name               ON world_thread TYPE string;
    DEFINE FIELD IF NOT EXISTS description        ON world_thread TYPE string;
    DEFINE FIELD IF NOT EXISTS tension            ON world_thread TYPE float DEFAULT 0.3;
    DEFINE FIELD IF NOT EXISTS urgency            ON world_thread TYPE float DEFAULT 0.3;
    DEFINE FIELD IF NOT EXISTS active             ON world_thread TYPE bool  DEFAULT true;
    DEFINE FIELD IF NOT EXISTS turn_opened        ON world_thread TYPE int   DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS turn_resolved      ON world_thread TYPE option<int>;
    DEFINE FIELD IF NOT EXISTS involved_actors    ON world_thread TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS involved_locations ON world_thread TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS consequence_seeds  ON world_thread TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS updated_at         ON world_thread TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS world_thread_session ON world_thread COLUMNS session_id;

    -- Spatial and relational edges: AT, LEADS_TO, HOLDS, AWARE_OF, GUARDS
    DEFINE TABLE IF NOT EXISTS world_edge TYPE RELATION SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS edge_type     ON world_edge TYPE string;
    DEFINE FIELD IF NOT EXISTS weight        ON world_edge TYPE float DEFAULT 1.0;
    DEFINE FIELD IF NOT EXISTS bidirectional ON world_edge TYPE bool  DEFAULT false;
    DEFINE FIELD IF NOT EXISTS metadata      ON world_edge TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS active        ON world_edge TYPE bool  DEFAULT true;
  `);

    // ── ACE SYSTEM TABLES ─────────────────────────────────────────────────────
    // Infrastructure for the agent pipeline.

    await db.query(`
    -- Dynamic agent definitions (persisted, rehydrated on boot)
    DEFINE TABLE IF NOT EXISTS agent_definition SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS name         ON agent_definition TYPE string;
    DEFINE FIELD IF NOT EXISTS role         ON agent_definition TYPE string;
    DEFINE FIELD IF NOT EXISTS instructions ON agent_definition TYPE string;
    DEFINE FIELD IF NOT EXISTS model        ON agent_definition TYPE string DEFAULT "gpt-4o-mini";
    DEFINE FIELD IF NOT EXISTS tools        ON agent_definition TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS active       ON agent_definition TYPE bool   DEFAULT true;
    DEFINE FIELD IF NOT EXISTS metadata     ON agent_definition TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS created_at   ON agent_definition TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS agent_name   ON agent_definition COLUMNS name UNIQUE;

    -- Structured agent output log (separate from lore_event which is player-facing)
    DEFINE TABLE IF NOT EXISTS narrative_event SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS session_id ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS agent_name ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS event_type ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS content    ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS metadata   ON narrative_event TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS created_at ON narrative_event TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS narrative_session ON narrative_event COLUMNS session_id;
  `);
}

// ═══════════════════════════════════════════════════════════════════════════
// LORE GRAPH HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export async function queryLoreGraph(
    query: string,
    vars?: Record<string, unknown>
) {
    const db = await getDB();
    return db.query(query, vars);
}

export async function getLoreContext(
    nodeId: string,
    depth = 2
): Promise<LoreContext> {
    const db = await getDB();
    const [result] = await db.query<[LoreNode[]]>(`
    SELECT id, kind, name, description, properties,
      ->lore_relation->(lore_node.{ id, kind, name }) AS related_out,
      <-lore_relation<-(lore_node.{ id, kind, name }) AS related_in
    FROM $nodeId
  `, { nodeId });
    return { root: result?.[0], depth };
}

/** Permanently record a player decision in the Lore Graph. */
export async function appendLoreEvent(
    event: Omit<LoreEvent, "id" | "created_at">
) {
    const db = await getDB();
    return db.create(new Table("lore_event")).content(event);
}

/** Codify a new relationship that formed during play. */
export async function codifyLoreRelation(
    fromId: string,
    toId: string,
    relationType: string,
    weight = 0.8,
    established = "during-play",
    metadata: Record<string, unknown> = {}
) {
    const db = await getDB();
    return db.query(
        `RELATE $from->lore_relation->$to SET
       relation_type = $relationType,
       weight = $weight,
       established = $established,
       metadata = $metadata`,
        { from: fromId, to: toId, relationType, weight, established, metadata }
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD GRAPH HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full world snapshot — what Generators and Curators read at the start
 * of each ACE turn to understand the current state of the simulation.
 * Scoped to a session so threads are filtered correctly.
 */
export async function getWorldSnapshot(sessionId: string): Promise<WorldSnapshot> {
    const db = await getDB();

    const [actors] = await db.query<[WorldActor[]]>(
        `SELECT * FROM world_actor WHERE active = true`
    );
    const [locations] = await db.query<[WorldLocation[]]>(
        `SELECT * FROM world_location`
    );
    const [items] = await db.query<[WorldItem[]]>(
        `SELECT * FROM world_item`
    );
    const [threads] = await db.query<[WorldThread[]]>(
        `SELECT * FROM world_thread WHERE session_id = $sid AND active = true`,
        { sid: sessionId }
    );

    return {
        actors: actors ?? [],
        locations: locations ?? [],
        items: items ?? [],
        threads: threads ?? [],
        snapshotAt: new Date().toISOString(),
    };
}

/** Move an actor to a new location — updates record + AT edge. */
export async function moveActor(actorId: string, newLocationId: string) {
    const db = await getDB();
    await db.query(
        `UPDATE $id SET location_id = $loc, updated_at = time::now()`,
        { id: actorId, loc: newLocationId }
    );
    await db.query(
        `UPDATE world_edge SET active = false WHERE in = $id AND edge_type = 'AT'`,
        { id: actorId }
    );
    await db.query(
        `RELATE $a->world_edge->$l SET edge_type = 'AT', active = true`,
        { a: actorId, l: newLocationId }
    );
}

/**
 * Apply a resolved player choice to the World Graph.
 * Called by the orchestrator after the Hero Agent validates the impact.
 */
export async function applyWorldImpact(
    sessionId: string,
    beatId: string,
    impact: WorldImpact
) {
    const db = await getDB();

    for (const [id, delta] of Object.entries(impact.actorDeltas ?? {})) {
        await db.query(
            `UPDATE $id SET state = object::merge(state, $d), updated_at = time::now()`,
            { id, d: delta }
        );
    }
    for (const [id, delta] of Object.entries(impact.locationDeltas ?? {})) {
        await db.query(
            `UPDATE $id SET state = object::merge(state, $d), updated_at = time::now()`,
            { id, d: delta }
        );
    }
    for (const [id, delta] of Object.entries(impact.itemDeltas ?? {})) {
        await db.query(
            `UPDATE $id SET state = object::merge(state, $d), updated_at = time::now()`,
            { id, d: delta }
        );
    }
    for (const edge of impact.newEdges ?? []) {
        await db.query(
            `RELATE $f->world_edge->$t SET
         edge_type = $type, weight = $w, metadata = $m, active = true`,
            { f: edge.from, t: edge.to, type: edge.type, w: edge.weight ?? 0.7, m: edge.metadata ?? {} }
        );
    }
    for (const thread of impact.newThreads ?? []) {
        await db.create(new Table("world_thread")).content({ ...thread, session_id: sessionId });
    }
}

/** Update a thread's tension/urgency (called by Swarm Agent 03). */
export async function updateThreadTension(
    threadId: string,
    tension: number,
    urgency?: number
) {
    const db = await getDB();
    return db.query(
        `UPDATE $id SET tension = $t, urgency = $u, updated_at = time::now()`,
        { id: threadId, t: tension, u: urgency ?? 0.3 }
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ACE SYSTEM HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export async function createAgentDefinition(def: AgentDefinition) {
    const db = await getDB();
    return db.create<AgentDefinition>(new Table("agent_definition")).content(def as Values<AgentDefinition>);
}

export async function getAgentDefinitions(role?: string) {
    const db = await getDB();
    if (role) {
        return db.query<[AgentDefinition[]]>(
            `SELECT * FROM agent_definition WHERE role = $role AND active = true`,
            { role }
        );
    }
    return db.query<[AgentDefinition[]]>(
        `SELECT * FROM agent_definition WHERE active = true`
    );
}

export async function logNarrativeEvent(
    event: Omit<NarrativeEvent, "id" | "created_at">
) {
    const db = await getDB();
    return db.create(new Table("narrative_event")).content(event);
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

// ── Lore Graph ───────────────────────────────────────────────────────────

export interface LoreNode {
    id: string;
    kind: "character" | "faction" | "location" | "item" | "event" | "concept";
    name: string;
    description: string;
    properties: Record<string, unknown>;
    canon: boolean;
    related_out?: Pick<LoreNode, "id" | "kind" | "name">[];
    related_in?: Pick<LoreNode, "id" | "kind" | "name">[];
}

export interface LoreContext {
    root: LoreNode;
    depth: number;
}

export interface LoreEvent {
    id?: string;
    session_id: string;
    turn_number: number;
    event_kind:
    | "decision"
    | "consequence"
    | "revelation"
    | "relationship_change"
    | "item_transfer"
    | "location_entered";
    description: string;
    actors: string[];
    locations: string[];
    items: string[];
    consequences: string[];
    player_choice?: string;
    created_at?: string;
}

// ── World Graph ───────────────────────────────────────────────────────────

export interface WorldActor {
    id: string;
    lore_ref: string;
    name: string;
    kind: "player" | "npc" | "faction_rep";
    location_id: string;
    disposition: "hostile" | "neutral" | "friendly" | "unknown";
    awareness: "unaware" | "suspicious" | "alerted" | "hostile" | "allied";
    goal_current: string;
    goal_hidden: string;
    state: Record<string, unknown>;
    active: boolean;
}

export interface WorldLocation {
    id: string;
    lore_ref: string;
    name: string;
    region: string;
    accessible: boolean;
    danger_level: number;
    atmosphere: string;
    secrets: string[];
    revealed_secrets: string[];
    state: Record<string, unknown>;
}

export interface WorldItem {
    id: string;
    lore_ref: string;
    name: string;
    holder_actor?: string;
    location_id?: string;
    accessible: boolean;
    known_to_player: boolean;
    condition: string;
    state: Record<string, unknown>;
}

export interface WorldThread {
    id: string;
    session_id: string;
    name: string;
    description: string;
    tension: number;
    urgency: number;
    active: boolean;
    turn_opened: number;
    turn_resolved?: number;
    involved_actors: string[];
    involved_locations: string[];
    consequence_seeds: string[];
}

export interface WorldSnapshot {
    actors: WorldActor[];
    locations: WorldLocation[];
    items: WorldItem[];
    threads: WorldThread[];
    snapshotAt: string;
}

export interface WorldImpact {
    actorDeltas: Record<string, Record<string, unknown>>;
    locationDeltas: Record<string, Record<string, unknown>>;
    itemDeltas: Record<string, Record<string, unknown>>;
    newEdges: Array<{
        from: string;
        to: string;
        type: string;
        weight?: number;
        metadata?: Record<string, unknown>;
    }>;
    newThreads: Partial<WorldThread>[];
    consequenceSeeds: string[];
    narrativePressure: number;
}

// ── ACE System ────────────────────────────────────────────────────────────

export interface AgentDefinition {
    id?: string;
    name: string;
    role: "generator" | "curator" | "reflector" | "swarm" | "hero";
    instructions: string;
    model?: string;
    tools?: string[];
    active?: boolean;
    metadata?: Record<string, unknown>;
}

export interface NarrativeEvent {
    id?: string;
    session_id: string;
    agent_name: string;
    event_type: "action" | "decision" | "outcome" | "reflection";
    content: string;
    metadata?: Record<string, unknown>;
    created_at?: string;
}