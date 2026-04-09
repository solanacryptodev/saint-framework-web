"use server";

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Table, StringRecordId } from "surrealdb";
import { getDB } from "../libs/surreal";
import type {
    WorldAgent,
    WorldLocation,
    WorldItem,
    WorldThread,
    LoreNode,
    WorldConcept,
    WorldEvent,
    WorldFaction,
} from "../libs/types";
import {
    getLoreContext,
    upsertWorldState,
    logNarrativeEvent,
    queryLoreGraph,
} from "../libs/surreal";

// ── Shared game_id field ───────────────────────────────────────────────────
// Every world graph record must carry game_id (scope to game) and
// session_id = "WORLD_INIT" (marks blueprint records before any player session).
// The agent receives game_id in its prompt and passes it to every tool call.

const gameIdField = z
    .string()
    .default("")
    .describe("The game record ID — passed through to scope all world graph records");

// ── write_world_location ───────────────────────────────────────────────────

export const writeLocationTool = createTool({
    id: "write_world_location",
    description: "Create a world_location entry with starting atmosphere, danger level, and unrevealed secrets",
    inputSchema: z.object({
        game_id: gameIdField,
        lore_node_name: z.string(),
        region: z.string().describe("District or area this location belongs to"),
        accessible: z.boolean().default(true),
        danger_level: z.number().min(0).max(1).default(0.2).describe("0 = safe, 1 = extremely dangerous"),
        atmosphere: z.string().describe("1-2 sentence sensory description of this place right now"),
        secrets: z.array(z.string()).default([]).describe("Hidden facts not yet revealed to player"),
        state: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ game_id, lore_node_name, region, accessible, danger_level, atmosphere, secrets, state }) => {
        const db = await getDB();

        const [loreRows] = await db.query<[LoreNode[]]>(
            `SELECT id FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: lore_node_name }
        );
        // FIX: lore_ref schema is option<record<lore_node>>, not string.
        // Pass the raw record ID (or undefined) instead of stringifying.
        const loreRef = loreRows?.[0] ? loreRows[0].id : undefined;

        const [created] = await db.create<WorldLocation>(new Table("world_location")).content({
            game_id: game_id,
            session_id: "WORLD_INIT",
            lore_ref: loreRef,
            name: lore_node_name,
            description: "",
            region: region,
            accessible: accessible,
            traversal_risk: Math.min(1, Math.max(0, danger_level!)),   // schema field name
            plausibility_modifier: 0.0,                                    // valid range -0.5 to 0.5
            atmosphere: atmosphere,
            secrets: secrets,
            revealed_secrets: [],
            gravitational_signature: [0.2, 0.2, 0.2] as [number, number, number],
            emotional_charge: 0,
            concept_imprint: {},
            memory_decay: 0.05,
            state: state ?? {},
        });

        return { world_id: String(created.id), name: lore_node_name, status: "created" };
    },
});

// ── write_world_agent ──────────────────────────────────────────────────────

export const writeAgentTool = createTool({
    id: "write_world_agent",
    description: "Create a world_agent entry for a character or NPC with their starting simulation state",
    inputSchema: z.object({
        game_id: gameIdField,
        lore_node_name: z.string().describe("Exact name of the corresponding lore_node"),
        kind: z.enum(["player", "npc", "faction_rep"]),
        starting_location_name: z.string().describe("Name of world_location where this agent starts"),
        disposition: z.enum(["hostile", "neutral", "friendly", "unknown"]).default("neutral"),
        awareness: z.enum(["unaware", "suspicious", "alerted", "hostile", "allied"]).default("unaware"),
        goal_current: z.string(),
        goal_hidden: z.string(),
        state: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ game_id, lore_node_name, kind, starting_location_name, disposition, awareness, goal_current, goal_hidden, state }) => {
        const db = await getDB();

        const [loreRows] = await db.query<[LoreNode[]]>(
            `SELECT id FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: lore_node_name }
        );
        const loreRef = loreRows?.[0] ? String(loreRows[0].id) : "";

        // Resolve starting location for denormalized location_id
        const [locRows] = await db.query<[WorldLocation[]]>(
            `SELECT id FROM world_location WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
            { n: starting_location_name, g: game_id }
        );
        const locationId = locRows?.[0] ? String(locRows[0].id) : null;

        const [created] = await db.create<WorldAgent>(new Table("world_agent")).content({
            game_id: game_id,
            session_id: "WORLD_INIT",
            lore_ref: loreRef,
            name: lore_node_name,
            kind,
            disposition,
            awareness,
            goal_current,
            goal_hidden,
            state: state ?? {},
            active: true,
            location_id: locationId ?? undefined,   // denormalized fast-lookup
            // SAINT physics defaults
            narrative_weight: 0.5,
            gravitational_signature: [0.3, 0.3, 0.3] as [number, number, number],
            emotional_charge: 0,
            influence_resonance: 0.5,
            vector_susceptibility: [0.5, 0.5, 0.5] as [number, number, number],
            concept_affinity: {},
            plausibility_threshold: 0.6,
            coherence_contribution: 0.5,
            agency_quota: 100,
            emergence_potential: 0.3,
            temporal_focus: 0.5,
            // Leverage system defaults
            known_leverage: [],
            hidden_leverage: [],
            leverage_resistance: 0.5,
            // Drama debt defaults
            drama_debt: {
                accumulated: 0.0,
                turns_since_impact: 0,
                last_impact_turn: 0,
                tolerance: 5,
            },
        });

        return { world_id: String(created.id), name: lore_node_name, status: "created", starting_location_hint: starting_location_name };
    },
});

// ── write_world_item ───────────────────────────────────────────────────────

export const writeItemTool = createTool({
    id: "write_world_item",
    description: "Place an item in the world with a holder or location",
    inputSchema: z.object({
        game_id: gameIdField,
        lore_node_name: z.string(),
        holder_actor_name: z.string().optional(),
        location_name: z.string().optional(),
        accessible: z.boolean().default(false),
        known_to_player: z.boolean().default(false),
        condition: z.string().default("intact"),
        state: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ game_id, lore_node_name, holder_actor_name, location_name, accessible, known_to_player, condition, state }) => {
        const db = await getDB();

        const [loreRows] = await db.query<[LoreNode[]]>(
            `SELECT id FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: lore_node_name }
        );
        const loreRef = loreRows?.[0] ? String(loreRows[0].id) : "";

        // Resolve holder — schema field is option<string> (plain string ID, not typed record)
        let holderActorId: string | undefined;
        if (holder_actor_name) {
            const [actorRows] = await db.query<[WorldAgent[]]>(
                `SELECT id FROM world_agent WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                { n: holder_actor_name, g: game_id }
            );
            holderActorId = actorRows?.[0] ? String(actorRows[0].id) : undefined;
        }

        // Resolve location — schema field is option<string>
        let locationId: string | undefined;
        if (location_name) {
            const [locRows] = await db.query<[WorldLocation[]]>(
                `SELECT id FROM world_location WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                { n: location_name, g: game_id }
            );
            locationId = locRows?.[0] ? String(locRows[0].id) : undefined;
        }

        const [created] = await db.create<WorldItem>(new Table("world_item")).content({
            game_id: game_id,
            session_id: "WORLD_INIT",
            lore_ref: loreRef,
            name: lore_node_name,
            description: "",
            kind: "artifact",
            held_by: holderActorId,    // plain string — schema is option<string>
            location_id: locationId,       // plain string — schema is option<string>
            accessible,
            known_to_player,
            condition,
            state: state ?? {},
            // SAINT physics defaults
            narrative_weight: 0.3,
            gravitational_mass: [0.2, 0.2, 0.2] as [number, number, number],
            concept_affinity: {},
            concept_transfer: 0.1,
            plausibility_anchor: 0.7,
        });

        return { world_id: String(created.id), name: lore_node_name, status: "created" };
    },
});

// ── write_world_faction ────────────────────────────────────────────────────

export const writeFactionTool = createTool({
    id: "write_world_faction",
    description: "Create a world_faction entry — an organized group with ideology, leadership, and territory",
    inputSchema: z.object({
        game_id: gameIdField,
        lore_node_name: z.string(),
        faction_type: z.string().default("agency"),
        status: z.string().default("active"),
        description: z.string().default(""),
        leadership_names: z.array(z.string()).default([]),
        member_names: z.array(z.string()).default([]),
        territory_names: z.array(z.string()).default([]),
        player_standing: z.number().min(-1).max(1).default(0),
        state: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ game_id, lore_node_name, faction_type, status, description, leadership_names, member_names, territory_names, player_standing, state }) => {
        const db = await getDB();

        const [loreRows] = await db.query<[LoreNode[]]>(
            `SELECT id FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: lore_node_name }
        );
        const loreRef = loreRows?.[0] ? String(loreRows[0].id) : "";

        const resolveAgents = async (names: string[]) => {
            const ids: string[] = [];
            for (const n of names) {
                const [rows] = await db.query<[WorldAgent[]]>(
                    `SELECT id FROM world_agent WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                    { n, g: game_id }
                );
                if (rows?.[0]) ids.push(String(rows[0].id));
            }
            return ids;
        };

        const resolveLocations = async (names: string[]) => {
            const ids: string[] = [];
            for (const n of names) {
                const [rows] = await db.query<[WorldLocation[]]>(
                    `SELECT id FROM world_location WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                    { n, g: game_id }
                );
                if (rows?.[0]) ids.push(String(rows[0].id));
            }
            return ids;
        };

        const [leadershipIds, memberIds, territoryIds] = await Promise.all([
            resolveAgents(leadership_names!),
            resolveAgents(member_names!),
            resolveLocations(territory_names!),
        ]);

        const [created] = await db.create<WorldFaction>(new Table("world_faction")).content({
            game_id: game_id,
            session_id: "WORLD_INIT",
            lore_ref: loreRef,
            name: lore_node_name,
            faction_type,
            status,
            description,                              // now in schema
            leadership_ids: leadershipIds,
            member_ids: memberIds,
            territory_ids: territoryIds,
            narrative_weight: 0.5,
            // FIX: world_faction schema expects gravitational_mass as object, not array
            gravitational_mass: { trauma: 0.0, hope: 0.0, mystery: 0.0 },
            emotional_charge: 0,
            swarm_coherence: 0.5,
            concept_affinity: [],
            concept_orthodoxy: 0.5,
            concept_propagation_rate: 0.3,
            internal_coherence: 0.6,
            vector_doctrine: { moral: 0.0, method: 0.0, social: 0.0 },
            vector_enforcement: 0.3,
            alliances: [],
            hostilities: [],
            player_standing,
            player_known_to: false,
            player_perceived_alignment: 0,
            state: state ?? {},
        });

        return { world_id: String(created.id), name: lore_node_name, status: "created" };
    },
});

// ── write_world_thread ─────────────────────────────────────────────────────

export const writeThreadTool = createTool({
    id: "write_world_thread",
    description: "Open a narrative thread — an unresolved tension that will drive the story",
    inputSchema: z.object({
        game_id: gameIdField,
        name: z.string(),
        description: z.string(),
        tension: z.number().min(0).max(1).default(0.4),
        urgency: z.number().min(0).max(1).default(0.3),
        involved_actor_names: z.array(z.string()).default([]),
        involved_location_names: z.array(z.string()).default([]),
        consequence_seeds: z.array(z.string()).default([]),
    }),
    execute: async ({ game_id, name, description, tension, urgency, involved_actor_names, involved_location_names, consequence_seeds }) => {
        const db = await getDB();

        const actorIds: string[] = [];
        for (const n of involved_actor_names!) {
            const [rows] = await db.query<[WorldAgent[]]>(
                `SELECT id FROM world_agent WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                { n, g: game_id }
            );
            if (rows?.[0]) actorIds.push(String(rows[0].id));
        }

        const locationIds: string[] = [];
        for (const n of involved_location_names!) {
            const [rows] = await db.query<[WorldLocation[]]>(
                `SELECT id FROM world_location WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                { n, g: game_id }
            );
            if (rows?.[0]) locationIds.push(String(rows[0].id));
        }

        const [created] = await db.create<WorldThread>(new Table("world_thread")).content({
            game_id: game_id,
            session_id: "WORLD_INIT",
            name,
            description,
            tension,
            urgency,
            active: true,
            turn_opened: 0,
            involved_actors: actorIds,
            involved_locations: locationIds,
            consequence_seeds,
        });

        return { world_id: String(created.id), name, tension, status: "created" };
    },
});

// ── write_world_concept ────────────────────────────────────────────────────

export const writeConceptTool = createTool({
    id: "write_world_concept",
    description: "Create a world_concept — an idea or ideology that propagates through the narrative swarm",
    inputSchema: z.object({
        game_id: gameIdField,
        lore_node_name: z.string(),
        description: z.string(),
        emotional_valence: z.number().min(-1).max(1).default(0),
        narrative_density: z.number().min(0).max(1).default(0.3),
        vector_amplification: z.tuple([z.number(), z.number(), z.number()]).default([1.0, 1.0, 1.0]),
        swarm_coherence: z.number().min(0).max(1).default(0),
        mutation_rate: z.number().min(0).max(1).default(0.1),
        gravitational_drag: z.number().min(0).max(1).default(0.5),
        plausibility_anchor: z.number().min(0).max(1).default(0.5),
        opposes: z.array(z.string()).default([]),
        evolves_from_name: z.string().optional(),
        known_to_player: z.boolean().default(false),
        state: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ game_id, lore_node_name, description, emotional_valence, narrative_density, vector_amplification, swarm_coherence, mutation_rate, gravitational_drag, plausibility_anchor, opposes, evolves_from_name, known_to_player, state }) => {
        const db = await getDB();

        const [loreRows] = await db.query<[LoreNode[]]>(
            `SELECT id FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: lore_node_name }
        );
        const loreRef = loreRows?.[0] ? String(loreRows[0].id) : "";

        const opposeIds: string[] = [];
        for (const n of opposes!) {
            const [rows] = await db.query<[{ id: string }[]]>(
                `SELECT id FROM world_concept WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                { n, g: game_id }
            );
            if (rows?.[0]) opposeIds.push(String(rows[0].id));
        }

        let evolvesFromId: string | undefined;
        if (evolves_from_name) {
            const [rows] = await db.query<[{ id: string }[]]>(
                `SELECT id FROM world_concept WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                { n: evolves_from_name, g: game_id }
            );
            evolvesFromId = rows?.[0] ? String(rows[0].id) : undefined;
        }

        const [created] = await db.create<WorldConcept>(new Table("world_concept")).content({
            game_id: game_id,
            session_id: "WORLD_INIT",
            lore_ref: loreRef,
            name: lore_node_name,
            description,
            emotional_valence,
            narrative_density,
            vector_amplification,
            swarm_coherence,
            mutation_rate,
            gravitational_drag,
            plausibility_anchor,
            opposes: opposeIds,
            evolves_from: evolvesFromId,
            active: true,
            known_to_player,
            state: state ?? {},
        });

        return { world_id: String(created.id), name: lore_node_name, status: "created" };
    },
});

// ── write_world_event ──────────────────────────────────────────────────────

export const writeEventTool = createTool({
    id: "write_world_event",
    description: "Create a world_event — a significant happening with narrative gravity",
    inputSchema: z.object({
        game_id: gameIdField,
        lore_node_name: z.string(),
        description: z.string(),
        participant_names: z.array(z.string()).default([]),
        location_name: z.string().optional(),
        gravitational_mass: z.tuple([z.number(), z.number(), z.number()]).default([0.0, 0.0, 0.0]),
        swarm_attention: z.number().min(0).max(1).default(0),
        coherence_stress: z.number().min(0).max(1).default(0),
        plausibility_decay: z.number().min(0).max(1).default(0.1),
        vector_imprint: z.tuple([z.number(), z.number(), z.number()]).default([0.0, 0.0, 0.0]),
        concept_seeding: z.record(z.string(), z.number()).default({}),
        temporal_ripple: z.number().min(0).max(10).default(0),
        phase_charge: z.number().min(0).max(1).default(0),
        significance: z.number().min(0).max(1).default(0.5),
        known_to_player: z.boolean().default(false),
        state: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ game_id, lore_node_name, description, participant_names, location_name, gravitational_mass, swarm_attention, coherence_stress, plausibility_decay, vector_imprint, concept_seeding, temporal_ripple, phase_charge, significance, known_to_player, state }) => {
        const db = await getDB();

        const [loreRows] = await db.query<[LoreNode[]]>(
            `SELECT id FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: lore_node_name }
        );
        const loreRef = loreRows?.[0] ? String(loreRows[0].id) : "";

        const participantIds: string[] = [];
        for (const n of participant_names!) {
            const [rows] = await db.query<[WorldAgent[]]>(
                `SELECT id FROM world_agent WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                { n, g: game_id }
            );
            if (rows?.[0]) participantIds.push(String(rows[0].id));
        }

        let locationId: string | undefined;
        if (location_name) {
            const [locRows] = await db.query<[WorldLocation[]]>(
                `SELECT id FROM world_location WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                { n: location_name, g: game_id }
            );
            locationId = locRows?.[0] ? String(locRows[0].id) : undefined;
        }

        const [created] = await db.create<WorldEvent>(new Table("world_event")).content({
            game_id: game_id,
            session_id: "WORLD_INIT",
            lore_ref: loreRef || undefined,
            name: lore_node_name,
            description,
            participants: participantIds,
            location_id: locationId,
            gravitational_mass,
            swarm_attention,
            coherence_stress,
            plausibility_decay,
            vector_imprint,
            concept_seeding,
            temporal_ripple,
            phase_charge,
            significance,
            resolved: false,
            known_to_player,
            state: state ?? {},
        });

        return { world_id: String(created.id), name: lore_node_name, status: "created" };
    },
});

// ── write_world_edge ───────────────────────────────────────────────────────

export const writeEdgeTool = createTool({
    id: "write_world_edge",
    description: "Create a spatial or relational edge. edge_type: AT (agent→location), LEADS_TO (location↔location), HOLDS (agent→item), AWARE_OF, GUARDS",
    inputSchema: z.object({
        game_id: gameIdField,
        from_name: z.string(),
        from_table: z.enum(["world_agent", "world_location", "world_item"]),
        to_name: z.string(),
        to_table: z.enum(["world_agent", "world_location", "world_item"]),
        edge_type: z.string(),
        weight: z.number().min(0).max(1).default(1.0),
        bidirectional: z.boolean().default(false),
        metadata: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ game_id, from_name, from_table, to_name, to_table, edge_type, weight, bidirectional, metadata }) => {
        const db = await getDB();

        const resolve = async (name: string, table: string) => {
            const [rows] = await db.query<[{ id: string }[]]>(
                `SELECT id FROM type::table($t) WHERE string::lowercase(name) = string::lowercase($n) AND game_id = $g LIMIT 1`,
                { t: table, n: name, g: game_id }
            );
            return rows?.[0] ? String(rows[0].id) : null;
        };

        const fromId = await resolve(from_name, from_table);
        const toId = await resolve(to_name, to_table);

        if (!fromId || !toId) {
            return { error: `Could not resolve: ${!fromId ? from_name : to_name}` };
        }

        const fromRid = new StringRecordId(fromId);
        const toRid = new StringRecordId(toId);

        await db.query(
            `RELATE $from->world_edge->$to SET
             edge_type = $type, weight = $w, bidirectional = $bi,
             metadata = $m, active = true`,
            { from: fromRid, to: toRid, type: edge_type, w: weight, bi: bidirectional, m: metadata }
        );

        // Update denormalized location_id on agent when AT edge is created
        if (edge_type === "AT" && from_table === "world_agent" && to_table === "world_location") {
            await db.query(
                `UPDATE $agent SET location_id = $loc, updated_at = time::now()`,
                { agent: fromRid, loc: toId }   // plain string ID for option<string> field
            );
        }

        if (bidirectional) {
            await db.query(
                `RELATE $from->world_edge->$to SET
                 edge_type = $type, weight = $w, bidirectional = true,
                 metadata = $m, active = true`,
                { from: toRid, to: fromRid, type: edge_type, w: weight, m: metadata }
            );
            if (edge_type === "AT" && to_table === "world_agent" && from_table === "world_location") {
                await db.query(
                    `UPDATE $agent SET location_id = $loc, updated_at = time::now()`,
                    { agent: toRid, loc: fromId }
                );
            }
        }

        return { from: from_name, to: to_name, type: edge_type, status: "created" };
    },
});

// ── Agent factory tools (shared across all agents) ─────────────────────────

export const loreQueryTool = createTool({
    id: "query_lore_graph",
    description: "Query the Lore Graph for world-building facts, character info, and relationships",
    inputSchema: z.object({
        nodeId: z.string().optional(),
        query: z.string(),
    }),
    execute: async ({ nodeId, query }) => {
        if (nodeId) return getLoreContext(nodeId, 2);
        return queryLoreGraph(query);
    },
});

export const worldStateTool = createTool({
    id: "update_world_state",
    description: "Write or update the World Graph",
    inputSchema: z.object({
        sessionId: z.string(),
        kind: z.enum(["scene", "thread", "state", "checkpoint"]),
        name: z.string(),
        payload: z.record(z.string(), z.unknown()),
    }),
    execute: async ({ sessionId, kind, name, payload }) => {
        return upsertWorldState(sessionId, kind, name, payload);
    },
});

export const logEventTool = createTool({
    id: "log_narrative_event",
    description: "Append a narrative event to the session history",
    inputSchema: z.object({
        sessionId: z.string(),
        agentName: z.string(),
        eventType: z.enum(["action", "decision", "outcome", "reflection"]),
        content: z.string(),
        metadata: z.record(z.string(), z.unknown()).optional(),
    }),
    execute: async ({ sessionId, agentName, eventType, content, metadata }) => {
        return logNarrativeEvent({
            session_id: sessionId,
            agent_name: agentName,
            event_type: eventType,
            content,
            metadata,
        });
    },
});
