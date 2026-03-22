"use server";

// src/agentic/world-init-agent.ts
//
// The World Initialization Agent runs AFTER the Lore Ingestion Agent has
// completed. It reads the populated lore_node records and uses them as a
// blueprint to seed the live World Graph with starting simulation state.
//
// Responsibilities:
//   • world_actor  — one entry per character/NPC with starting location,
//                    disposition, current + hidden goals, and initial state
//   • world_location — one entry per location with danger level, atmosphere,
//                      sealed secrets, and spatial edges to adjacent locations
//   • world_item   — one entry per item with holder, location, and
//                    whether the player can currently access it
//   • world_thread — the opening narrative threads derived from the
//                    unresolved tensions described in History & Secrets
//   • world_edge   — AT / LEADS_TO / HOLDS / AWARE_OF edges that wire
//                    everything together spatially and relationally
//
// The agent also places the PLAYER agent at their starting location and
// marks which items and NPCs are immediately visible to them.

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getDB } from "../libs/surreal";
import {
    WorldAgent,
    WorldLocation,
    WorldItem,
    WorldConcept,
    WorldEvent,
    WorldThread,
    LoreNode,
    WorldInitReport,
    IngestionProgress
} from "../libs/types";
import {
    writeAgentTool,
    writeLocationTool,
    writeItemTool,
    writeThreadTool,
    writeEdgeTool,
    writeConceptTool,
    writeEventTool,
    writeFactionTool
} from "./tools";


const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// ── Agent ──────────────────────────────────────────────────────────────────

export function buildWorldInitAgent(): Agent {
    return new Agent({
        id: "world-init-agent",
        name: "world-init-agent",
        model: openrouter("minimax/minimax-m2.7"),
        instructions: `
You are the World Initialization Agent for the ACE Narrative Engine.
Your job is to take a completed Lore Graph and initialize the live World Graph —
the starting simulation state that the player will enter.

You have eight tools:
1. write_world_agent   — place each character/NPC with goals and disposition
2. write_world_location — create each location with atmosphere + hidden secrets
3. write_world_faction — create each faction with leadership, members, and territory
4. write_world_item    — place each item with its holder or location
5. write_world_concept — create each concept with its properties
6. write_world_event   — create each event with its properties
7. write_world_thread  — open narrative threads from unresolved tensions
8. write_world_edge    — wire entities together with spatial/relational edges

STRICT RULES:
- You MUST build the world in verbatim based on the lore provided. Only add small details, don't erase/replace the lore.
- Write ALL locations FIRST (agents, factions, and items reference them)
- Write ALL agents SECOND (factions, items, and edges reference them)
- Write ALL factions THIRD (edges reference them)
- Write ALL events FOURTH (they reference agents + locations)
- Write ALL items FIFTH (they reference agents + locations)
- Write ALL concepts SIXTH
- Write ALL threads SEVENTH (they reference agents + locations)
- Write ALL edges LAST — including AT edges that wire every agent to their starting location

IMPORTANT: Agent location is set via write_world_edge, NOT inside write_world_agent.
After writing all agents, call write_world_edge with edge_type='AT' for every agent.

WHAT TO DERIVE FOR EACH ENTITY TYPE:

world_location:
  - traversal_risk: 0.0 (The Archive lobby) → 1.0 (deep Underspire) — previously called danger_level
  - accessible: false for locked/hidden locations the player can't reach yet OR places that are hard to access without considerable effort
  - atmosphere: write a present-tense sensory sentence ("Dust and cold iron. The shelves go up forever.")
  - secrets: hidden facts from History & Secrets that belong to this location

world_agent:
  - kind="player" for the protagonist; everyone else is "npc" or "faction_rep"
  - disposition toward the player: hostile/neutral/friendly/unknown
  - awareness of the player: unaware/suspicious/alerted/hostile/allied
  - goal_current: what they appear to be doing
  - goal_hidden: their real agenda (the thing they'd never say aloud)

world_item:
  - accessible=true ONLY if the player could plausibly pick it up at game start
  - known_to_player=true ONLY if the item is publicly known or the player owns it
  - If an item is held by an NPC, set held_by AND location_id
  - Use VERBS to describe the item's CONDITION: "pristine", "damaged", "broken", "ancient", "cursed", "rugged", "tattered", "worn", etc.
  - If the owner(holder) if an item is unknown, set the held_by to unknown, lost or hidden depending on the context of the lore.
  - The KIND of item it is includes things like: artifacts, clothing, tools, relics, keys, documents, weapons, armor, etc.

world_concept:
  - description: a concise explanation of what this concept means in the game world
  - emotional_valence: -1.0 (dark/harmful) to 1.0 (hopeful/positive)

world_event:
  - description: a concise explanation of what this event means in the game world
  - significance: 0.0-1.0 narrative weight of this event

world_thread:
  - One thread per major unresolved tension from History & Secrets
  - tension: how narratively charged is this right now (0-1)
  - urgency: how soon will it force itself into play (0-1)
  - consequence_seeds: concrete things that happen if the player ignores this thread

world_edge:
  - AT: every agent at their starting location (REQUIRED for every agent)
  - LEADS_TO (bidirectional): every traversable path between locations
  - HOLDS: agents who currently carry items
  - AWARE_OF: NPCs who know about other NPCs or items (with weight = how well they know)
  - GUARDS: agents or factions that block access to a location/item

world_faction:
  - FACTION_TYPE: unless specified otherwise, can be either guilds, corporations, government, criminal, religious, syndicates, movement, etc.
  - STATUS: unless specified otherwise, can be either active, inactive, defunct, etc.
  - Unless otherwise specified: leadership_id, member_id, and territory_id MUST be set to Unknown.

Place the protagonist (kind="player") in a narratively interesting starting position —
ideally where multiple threads intersect and multiple NPCs are nearby.

After writing everything, briefly summarize the starting world state.
    `.trim(),
        tools: {
            write_world_agent: writeAgentTool,
            write_world_location: writeLocationTool,
            write_world_faction: writeFactionTool,
            write_world_item: writeItemTool,
            write_world_concept: writeConceptTool,
            write_world_event: writeEventTool,
            write_world_thread: writeThreadTool,
            write_world_edge: writeEdgeTool,
        },
    });
}

// ── Main initialization pipeline ───────────────────────────────────────────

export async function initializeWorldGraph(
    loreSummary: string,   // prose summary of the lore bible
    loreNodes: LoreNode[], // all nodes written by the Lore Ingestion Agent
    onProgress?: (update: IngestionProgress) => void
): Promise<WorldInitReport> {
    const db = await getDB();

    onProgress?.({ phase: "world_init", message: "World Init Agent reading lore graph…", percent: 60 });

    // Build a compact representation of the lore graph to feed the agent
    const loreContext = buildLoreContextForAgent(loreNodes);

    const agent = buildWorldInitAgent();

    const response = await agent.generate([
        {
            role: "user",
            content: `
Initialize the World Graph from the following lore context.

LORE SUMMARY:
${loreSummary}

LORE ENTITIES:
${loreContext}

Instructions:
1. Write all world_locations (every named place)
2. Write all world_actors (every named character, including the protagonist)
3. Write all world_items (every named artifact/item)
4. Write all world_concepts (every named concept)
5. Write all world_events (every named event)
6. Write world_threads for every unresolved tension from the Secrets section
7. Write world_edges: AT (actor→location), LEADS_TO (location↔location), HOLDS (actor→item), AWARE_OF, GUARDS

Place the player character at a narratively rich starting position.
After finishing all writes, summarize the starting world state in 2-3 sentences.
      `.trim(),
        },
    ], {
        maxSteps: 200,
    });

    onProgress?.({ phase: "world_init", message: "Collecting world graph results…", percent: 88 });

    // Collect results
    const [agents] = await db.query<[WorldAgent[]]>(`SELECT id, name, kind, disposition, goal_current FROM world_agent`);
    const [locations] = await db.query<[WorldLocation[]]>(`SELECT id, name, region, accessible, atmosphere, secrets FROM world_location`);
    const [items] = await db.query<[WorldItem[]]>(`SELECT id, name, held_by, location_id, known_to_player FROM world_item`);
    const [concepts] = await db.query<[WorldConcept[]]>(`SELECT id, name, description, emotional_valence, swarm_coherence FROM world_concept`);
    const [events] = await db.query<[WorldEvent[]]>(`SELECT id, name, description, participants, location_id FROM world_event`);
    const [threads] = await db.query<[WorldThread[]]>(`SELECT id, name, tension, urgency FROM world_thread WHERE session_id = 'WORLD_INIT'`);
    const [edges] = await db.query<[{ count: number }[]]>(`SELECT count() AS count FROM world_edge GROUP ALL`);

    // console.log("[world-init] agent response:", response.text.slice(0, 500));
    // console.log("[world-init] agents from DB:", agents?.length, agents?.[0]);
    // console.log("[world-init] locations from DB:", locations?.length, locations?.[0]);
    // console.log("[world-init] items from DB:", items?.length, items?.[0]);
    // console.log("[world-init] threads from DB:", threads?.length, threads?.[0]);
    // console.log("[world-init] edges from DB:", edges?.length, edges?.[0]);

    // Resolve location names for agent placement display
    const locationMap: Record<string, string> = {};
    for (const loc of (locations ?? [])) {
        locationMap[String(loc.id)] = loc.name;
    }

    const agentMap: Record<string, string> = {};
    for (const a of (agents ?? [])) {
        agentMap[String(a.id)] = a.name;
    }

    const conceptMap: Record<string, string> = {};
    for (const c of (concepts ?? [])) {
        conceptMap[String(c.id)] = c.name;
    }

    const eventMap: Record<string, string> = {};
    for (const e of (events ?? [])) {
        eventMap[String(e.id)] = e.name;
    }

    const playerAgent = (agents ?? []).find(a => a.kind === "player");

    // Check for warnings
    const warnings: string[] = [];
    if ((agents ?? []).length === 0) warnings.push("No agents were written — check agent tool calls");
    if ((locations ?? []).length === 0) warnings.push("No locations were written");
    if ((items ?? []).length === 0) warnings.push("No items were written");
    if ((concepts ?? []).length === 0) warnings.push("No concepts were written");
    if ((events ?? []).length === 0) warnings.push("No events were written");
    if (!playerAgent) warnings.push("No agent with kind='player' was created");

    return {
        agentsPlaced: (agents ?? []).map(a => ({
            world_id: String(a.id),
            lore_name: a.name,
            kind: a.kind,
            starting_location: "see world_edge AT",
            disposition: a.disposition,
            goal_current: a.goal_current,
        })),
        locationsCreated: (locations ?? []).map(l => ({
            world_id: String(l.id),
            lore_name: l.name,
            region: l.region,
            danger_level: l.traversal_risk,
            accessible: l.accessible,
            secret_count: (l.secrets ?? []).length,
        })),
        itemsPlaced: (items ?? []).map(i => ({
            world_id: String(i.id),
            lore_name: i.name,
            holder: i.held_by ? agentMap[i.held_by] : undefined,
            location: i.location_id ? locationMap[i.location_id] : undefined,
            known_to_player: i.known_to_player,
        })),
        conceptsCreated: (concepts ?? []).map(c => ({
            world_id: String(c.id),
            lore_name: c.name,
            description: c.description,
            emotional_valence: c.emotional_valence,
            swarm_coherence: c.swarm_coherence,
        })),
        eventsCreated: (events ?? []).map(e => ({
            world_id: String(e.id),
            lore_name: e.name,
            description: e.description,
            location: e.location_id ? locationMap[e.location_id] : undefined,
            participant_count: (e.participants ?? []).length,
            significance: e.significance,
        })),
        threadsOpened: (threads ?? []).map(t => ({
            world_id: String(t.id),
            name: t.name,
            tension: t.tension,
            urgency: t.urgency,
        })),
        edgesCreated: edges?.[0]?.count ?? 0,
        playerStartLocation: playerAgent ? "see world_edge AT" : "unplaced",
        warnings,
        summary: response.text,
        completedAt: new Date().toISOString(),
    };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildLoreContextForAgent(nodes: LoreNode[]): string {
    const byKind: Record<string, LoreNode[]> = {};
    for (const n of nodes) {
        byKind[n.kind] = byKind[n.kind] ?? [];
        byKind[n.kind].push(n);
    }

    return Object.entries(byKind).map(([kind, kindNodes]) => {
        const entries = kindNodes.map(n => {
            const props = Object.entries(n.properties ?? {})
                .filter(([k]) => !["aliases", "source"].includes(k))
                .map(([k, v]) => `    ${k}: ${v}`)
                .join("\n");
            return `  • ${n.name}\n    ${n.description}${props ? "\n" + props : ""}`;
        }).join("\n");
        return `${kind.toUpperCase()}S:\n${entries}`;
    }).join("\n\n");
}