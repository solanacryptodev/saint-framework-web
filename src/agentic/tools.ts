import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Table, StringRecordId } from "surrealdb";
import { getDB } from "../libs/surreal";
import { WorldActor, WorldLocation, WorldItem, WorldThread, LoreNode, WorldInitReport } from "../libs/types";
import {
    getLoreContext,
    upsertWorldState,
    logNarrativeEvent,
    queryLoreGraph
} from "../libs/surreal";

// ── World Init Tools ──────────────────────────────────────────────────────────────────

export const writeActorTool = createTool({
    id: "write_world_actor",
    description: "Create a world_actor entry for a character or NPC with their starting simulation state",
    inputSchema: z.object({
        lore_node_name: z.string().describe("Exact name of the corresponding lore_node"),
        kind: z.enum(["player", "npc", "faction_rep"]),
        starting_location_name: z.string().describe("Name of world_location where this actor starts"),
        disposition: z.enum(["hostile", "neutral", "friendly", "unknown"]).default("neutral"),
        awareness: z.enum(["unaware", "suspicious", "alerted", "hostile", "allied"]).default("unaware"),
        goal_current: z.string().describe("What the actor is visibly trying to do right now"),
        goal_hidden: z.string().describe("Their true hidden agenda — not visible to player"),
        state: z.record(z.string(), z.unknown()).default({}).describe("Any extra state: health, inventory flags, mood, etc."),
    }),
    execute: async ({ lore_node_name, kind, starting_location_name, disposition, awareness, goal_current, goal_hidden, state }) => {
        const db = await getDB();

        // Resolve lore reference
        const [loreRows] = await db.query<[LoreNode[]]>(
            `SELECT id FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: lore_node_name }
        );
        const loreRef = loreRows?.[0] ? String(loreRows[0].id) : "";

        // Resolve starting location (may not exist yet — store name, ID linked later)
        const [locRows] = await db.query<[WorldLocation[]]>(
            `SELECT id FROM world_location WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: starting_location_name }
        );
        const locationId = locRows?.[0] ? String(locRows[0].id) : null;

        const [created] = await db.create<WorldActor>(new Table("world_actor")).content({
            lore_ref: loreRef,
            name: lore_node_name,
            kind: kind,
            location_id: locationId || "",
            disposition: disposition,
            awareness: awareness,
            goal_current: goal_current,
            goal_hidden: goal_hidden,
            state: state ?? {},
            active: true,
        });

        return { world_id: String(created.id), name: lore_node_name, status: "created" };
    },
});

export const writeLocationTool = createTool({
    id: "write_world_location",
    description: "Create a world_location entry with starting atmosphere, danger level, and unrevealed secrets",
    inputSchema: z.object({
        lore_node_name: z.string(),
        region: z.string().describe("District or area this location belongs to"),
        accessible: z.boolean().default(true).describe("Can the player travel here at game start?"),
        danger_level: z.number().min(0).max(1).default(0.2).describe("0 = safe, 1 = extremely dangerous"),
        atmosphere: z.string().describe("1-2 sentence sensory description of this place right now"),
        secrets: z.array(z.string()).default([]).describe("Hidden facts about this location — not yet revealed to player"),
        state: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ lore_node_name, region, accessible, danger_level, atmosphere, secrets, state }) => {
        const db = await getDB();

        const [loreRows] = await db.query<[LoreNode[]]>(
            `SELECT id FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: lore_node_name }
        );
        const loreRef = loreRows?.[0] ? String(loreRows[0].id) : "";

        const [created] = await db.create<WorldLocation>(new Table("world_location")).content({
            lore_ref: loreRef,
            name: lore_node_name,
            region: region,
            accessible: accessible,
            danger_level: danger_level,
            atmosphere: atmosphere,
            secrets: secrets,
            revealed_secrets: [],
            state: state ?? {},
        });

        return { world_id: String(created.id), name: lore_node_name, status: "created" };
    },
});

export const writeItemTool = createTool({
    id: "write_world_item",
    description: "Place an item in the world — with a holder (NPC/player) or a location, and whether it is currently findable",
    inputSchema: z.object({
        lore_node_name: z.string(),
        holder_actor_name: z.string().optional().describe("Name of world_actor currently holding this item"),
        location_name: z.string().optional().describe("Name of world_location where this item sits (if unowned)"),
        accessible: z.boolean().default(false).describe("Can the player currently obtain or interact with this item?"),
        known_to_player: z.boolean().default(false).describe("Does the player know this item exists?"),
        condition: z.string().default("intact"),
        state: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ lore_node_name, holder_actor_name, location_name, accessible, known_to_player, condition, state }) => {
        const db = await getDB();

        const [loreRows] = await db.query<[LoreNode[]]>(
            `SELECT id FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: lore_node_name }
        );
        const loreRef = loreRows?.[0] ? String(loreRows[0].id) : "";

        // Resolve holder
        let holderActorId: string | undefined;
        if (holder_actor_name) {
            const [actorRows] = await db.query<[WorldActor[]]>(
                `SELECT id FROM world_actor WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
                { n: holder_actor_name }
            );
            holderActorId = actorRows?.[0] ? String(actorRows[0].id) : undefined;
        }

        // Resolve location
        let locationId: string | undefined;
        if (location_name) {
            const [locRows] = await db.query<[WorldLocation[]]>(
                `SELECT id FROM world_location WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
                { n: location_name }
            );
            locationId = locRows?.[0] ? String(locRows[0].id) : undefined;
        }

        const [created] = await db.create<WorldItem>(new Table("world_item")).content({
            lore_ref: loreRef,
            name: lore_node_name,
            holder_actor: holderActorId,
            location_id: locationId,
            accessible: accessible,
            known_to_player: known_to_player,
            condition: condition,
            state: state ?? {},
        });

        return { world_id: String(created.id), name: lore_node_name, status: "created" };
    },
});

export const writeThreadTool = createTool({
    id: "write_world_thread",
    description: "Open a narrative thread — an unresolved tension, mystery, or conflict that will drive the story",
    inputSchema: z.object({
        name: z.string().describe("Short thread identifier e.g. 'The Missing Archivist'"),
        description: z.string().describe("1-2 sentences: what is at stake, who is involved, what will happen if unresolved"),
        tension: z.number().min(0).max(1).default(0.4),
        urgency: z.number().min(0).max(1).default(0.3).describe("How soon will this thread force itself into the story"),
        involved_actor_names: z.array(z.string()).default([]),
        involved_location_names: z.array(z.string()).default([]),
        consequence_seeds: z.array(z.string()).default([]).describe("What will happen if the player ignores this thread"),
    }),
    execute: async ({ name, description, tension, urgency, involved_actor_names, involved_location_names, consequence_seeds }) => {
        const db = await getDB();

        // Resolve actors
        const actorIds: string[] = [];
        for (const name of involved_actor_names ?? []) {
            const [rows] = await db.query<[WorldActor[]]>(
                `SELECT id FROM world_actor WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
                { n: name }
            );
            if (rows?.[0]) actorIds.push(String(rows[0].id));
        }

        // Resolve locations
        const locationIds: string[] = [];
        for (const name of involved_location_names ?? []) {
            const [rows] = await db.query<[WorldLocation[]]>(
                `SELECT id FROM world_location WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
                { n: name }
            );
            if (rows?.[0]) locationIds.push(String(rows[0].id));
        }

        const [created] = await db.create<WorldThread>(new Table("world_thread")).content({
            session_id: "WORLD_INIT",
            name: name,
            description: description,
            tension: tension,
            urgency: urgency,
            active: true,
            turn_opened: 0,
            involved_actors: actorIds,
            involved_locations: locationIds,
            consequence_seeds: consequence_seeds,
        });

        return { world_id: String(created.id), name: name, tension: tension, status: "created" };
    },
});

export const writeEdgeTool = createTool({
    id: "write_world_edge",
    description: "Create a spatial or relational edge between two world entities. Use edge_type: AT (actor in location), LEADS_TO (location to location), HOLDS (actor has item), AWARE_OF (actor knows of actor/item), GUARDS (actor prevents access to location/item)",
    inputSchema: z.object({
        from_name: z.string().describe("Name of the source entity"),
        from_table: z.enum(["world_actor", "world_location", "world_item"]),
        to_name: z.string().describe("Name of the target entity"),
        to_table: z.enum(["world_actor", "world_location", "world_item"]),
        edge_type: z.string().describe("AT | LEADS_TO | HOLDS | AWARE_OF | GUARDS | NEAR | SEEKS"),
        weight: z.number().min(0).max(1).default(1.0),
        bidirectional: z.boolean().default(false),
        metadata: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ from_name, from_table, to_name, to_table, edge_type, weight, bidirectional, metadata }) => {
        const db = await getDB();

        const resolve = async (name: string, table: string) => {
            const [rows] = await db.query<[{ id: string }[]]>(
                `SELECT id FROM type::table($t) WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
                { t: table, n: name }
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
       edge_type = $type, weight = $w, bidirectional = $bi, metadata = $m, active = true`,
            { from: fromRid, to: toRid, type: edge_type, w: weight, bi: bidirectional, m: metadata }
        );

        if (bidirectional) {
            await db.query(
                `RELATE $from->world_edge->$to SET
           edge_type = $type, weight = $w, bidirectional = true, metadata = $m, active = true`,
                { from: toRid, to: fromRid, type: edge_type, w: weight, m: metadata }
            );
        }

        return { from: from_name, to: to_name, type: edge_type, status: "created" };
    },
});

// ── Agent Factory Tools (available to all agents) ────────────────────────────────

export const loreQueryTool = createTool({
    id: "query_lore_graph",
    description: "Query the Lore Graph for world-building facts, character info, and relationships",
    inputSchema: z.object({
        nodeId: z.string().optional().describe("Specific lore node ID to start from"),
        query: z.string().describe("SurrealDB query or natural language lore question"),
    }),
    execute: async ({ nodeId, query }) => {
        if (nodeId) {
            return getLoreContext(nodeId, 2);
        }
        return queryLoreGraph(query);
    },
});

export const worldStateTool = createTool({
    id: "update_world_state",
    description: "Write or update the World Graph — commit narrative decisions, scene changes, or state transitions",
    inputSchema: z.object({
        sessionId: z.string(),
        kind: z.enum(["scene", "thread", "state", "checkpoint"]),
        name: z.string().describe("Unique name for this world node"),
        payload: z.record(z.string(), z.unknown()).describe("Arbitrary state data"),
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
