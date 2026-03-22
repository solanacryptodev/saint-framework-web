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
//   is ever needed, add game_id columns to lore_node, world_agent,
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
import type {
    WorldAgent,
    WorldLocation,
    WorldItem,
    WorldEvent,
    WorldConcept,
    WorldThread,
    WorldSnapshot,
    WorldImpact,
    LoreNode,
    LoreContext,
    LoreEvent,
    AgentDefinition,
    NarrativeEvent
} from "./types";
import { applySchema, applyGameSchema, applyPlayerCharacterSchema, applyEntityAssetSchema } from "./schemas";

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
        await applyGameSchema();
        await applyPlayerCharacterSchema();
        await applyEntityAssetSchema();
        _schemaApplied = true;
    }
    return _db;
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

    const [agents] = await db.query<[WorldAgent[]]>(
        `SELECT * FROM world_agent WHERE active = true`
    );
    const [locations] = await db.query<[WorldLocation[]]>(
        `SELECT * FROM world_location`
    );
    const [items] = await db.query<[WorldItem[]]>(
        `SELECT * FROM world_item`
    );
    const [events] = await db.query<[WorldEvent[]]>(
        `SELECT * FROM world_event`
    );
    const [concepts] = await db.query<[WorldConcept[]]>(
        `SELECT * FROM world_concept`
    );
    const [threads] = await db.query<[WorldThread[]]>(
        `SELECT * FROM world_thread WHERE session_id = $sid AND active = true`,
        { sid: sessionId }
    );

    return {
        actors: agents ?? [],
        locations: locations ?? [],
        items: items ?? [],
        events: events ?? [],
        concepts: concepts ?? [],
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

/** 
 * Upsert a named state blob into world_thread.
 * Used by agents via the update_world_state tool, and by the orchestrator
 * to checkpoint beat state between generate and choose steps.
 */
export async function upsertWorldState(
    sessionId: string,
    kind: string,
    name: string,
    payload: Record<string, unknown>
) {
    const db = await getDB();
    return db.query(`
    UPSERT world_thread
    SET session_id = $sid,
        name        = $name,
        description = $name,
        state       = $payload,
        active      = true
    WHERE name       = $name
      AND session_id = $sid
  `, { sid: sessionId, name, payload: { ...payload, kind } });
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
