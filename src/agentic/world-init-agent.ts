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
// The agent also places the PLAYER actor at their starting location and
// marks which items and NPCs are immediately visible to them.

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getDB } from "../libs/surreal";
import { WorldActor, WorldLocation, WorldItem, WorldThread, LoreNode, WorldInitReport, IngestionProgress } from "../libs/types";
import { writeActorTool, writeLocationTool, writeItemTool, writeThreadTool, writeEdgeTool } from "./tools";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// ── Agent ──────────────────────────────────────────────────────────────────

export function buildWorldInitAgent(): Agent {
    return new Agent({
        id: "world-init-agent",
        name: "world-init-agent",
        model: openrouter("openrouter/healer-alpha"),
        instructions: `
You are the World Initialization Agent for the ACE Narrative Engine.
Your job is to take a completed Lore Graph and initialize the live World Graph —
the starting simulation state that the player will enter.

You have five tools:
1. write_world_actor   — place each character/NPC in a starting location with goals
2. write_world_location — create each location with atmosphere + hidden secrets
3. write_world_item    — place each item with its holder or location
4. write_world_thread  — open narrative threads from unresolved tensions
5. write_world_edge    — wire entities together with spatial/relational edges

STRICT RULES:
- Write ALL locations FIRST (actors and items reference them)
- Write ALL actors SECOND (items and edges reference them)
- Write ALL items THIRD
- Write ALL threads FOURTH (they reference actors + locations)
- Write ALL edges LAST

WHAT TO DERIVE FOR EACH ENTITY TYPE:

world_location:
  - danger_level: 0.0 (The Archive lobby) → 1.0 (deep Underspire)
  - accessible: false for locked/hidden locations the player can't reach yet
  - atmosphere: write a present-tense sensory sentence ("Dust and cold iron. The shelves go up forever.")
  - secrets: hidden facts from History & Secrets that belong to this location

world_actor:
  - kind="player" for the protagonist; everyone else is "npc" or "faction_rep"
  - disposition toward the player: hostile/neutral/friendly/unknown
  - awareness of the player: unaware/suspicious/alerted/hostile/allied
  - goal_current: what they appear to be doing
  - goal_hidden: their real agenda (the thing they'd never say aloud)

world_item:
  - accessible=true only if the player could plausibly pick it up at game start
  - known_to_player=true only if the item is publicly known or the player owns it
  - If an item is held by an NPC who is at a location, set both holder_actor AND location

world_thread:
  - One thread per major unresolved tension from History & Secrets
  - tension: how narratively charged is this right now (0-1)
  - urgency: how soon will it force itself into play (0-1)
  - consequence_seeds: concrete things that happen if the player ignores this thread

world_edge:
  - AT: every actor at their starting location
  - LEADS_TO (bidirectional): every traversable path between locations
  - HOLDS: actors who currently carry items
  - AWARE_OF: NPCs who know about other NPCs or items (with weight = how well they know)
  - GUARDS: actors or factions that block access to a location/item

Place the protagonist (kind="player") in a narratively interesting starting position —
ideally where multiple threads intersect and multiple NPCs are nearby.

After writing everything, briefly summarize the starting world state.
    `.trim(),
        tools: {
            write_world_actor: writeActorTool,
            write_world_location: writeLocationTool,
            write_world_item: writeItemTool,
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
4. Write world_threads for every unresolved tension from the Secrets section
5. Write world_edges: AT (actor→location), LEADS_TO (location↔location), HOLDS (actor→item), AWARE_OF, GUARDS

Place the player character at a narratively rich starting position.
After finishing all writes, summarize the starting world state in 2-3 sentences.
      `.trim(),
        },
    ], {
        maxSteps: 200,
    });

    onProgress?.({ phase: "world_init", message: "Collecting world graph results…", percent: 88 });

    // Collect results
    const [actors] = await db.query<[WorldActor[]]>(`SELECT id, name, kind, disposition, goal_current, location_id FROM world_actor`);
    const [locations] = await db.query<[WorldLocation[]]>(`SELECT id, name, region, danger_level, accessible, secrets FROM world_location`);
    const [items] = await db.query<[WorldItem[]]>(`SELECT id, name, holder_actor, location_id, known_to_player FROM world_item`);
    const [threads] = await db.query<[WorldThread[]]>(`SELECT id, name, tension, urgency FROM world_thread WHERE session_id = 'WORLD_INIT'`);
    const [edges] = await db.query<[{ count: number }[]]>(`SELECT count() AS count FROM world_edge GROUP ALL`);

    console.log("[world-init] agent response:", response.text.slice(0, 500));
    console.log("[world-init] actors from DB:", actors?.length, actors?.[0]);
    console.log("[world-init] locations from DB:", locations?.length, locations?.[0]);
    console.log("[world-init] items from DB:", items?.length, items?.[0]);
    console.log("[world-init] threads from DB:", threads?.length, threads?.[0]);
    console.log("[world-init] edges from DB:", edges?.length, edges?.[0]);

    // Resolve location names for actor placement display
    const locationMap: Record<string, string> = {};
    for (const loc of (locations ?? [])) {
        locationMap[String(loc.id)] = loc.name;
    }

    const actorMap: Record<string, string> = {};
    for (const a of (actors ?? [])) {
        actorMap[String(a.id)] = a.name;
    }

    const playerActor = (actors ?? []).find(a => a.kind === "player");

    // Check for warnings
    const warnings: string[] = [];
    if ((actors ?? []).length === 0) warnings.push("No actors were written — check agent tool calls");
    if ((locations ?? []).length === 0) warnings.push("No locations were written");
    if ((items ?? []).length === 0) warnings.push("No items were written");
    if (!playerActor) warnings.push("No actor with kind='player' was created");

    return {
        actorsPlaced: (actors ?? []).map(a => ({
            world_id: String(a.id),
            lore_name: a.name,
            kind: a.kind,
            starting_location: locationMap[a.location_id] ?? "unknown",
            disposition: a.disposition,
            goal_current: a.goal_current,
        })),
        locationsCreated: (locations ?? []).map(l => ({
            world_id: String(l.id),
            lore_name: l.name,
            region: l.region,
            danger_level: l.danger_level,
            accessible: l.accessible,
            secret_count: (l.secrets ?? []).length,
        })),
        itemsPlaced: (items ?? []).map(i => ({
            world_id: String(i.id),
            lore_name: i.name,
            holder: i.holder_actor ? actorMap[i.holder_actor] : undefined,
            location: i.location_id ? locationMap[i.location_id] : undefined,
            known_to_player: i.known_to_player,
        })),
        threadsOpened: (threads ?? []).map(t => ({
            world_id: String(t.id),
            name: t.name,
            tension: t.tension,
            urgency: t.urgency,
        })),
        edgesCreated: edges?.[0]?.count ?? 0,
        playerStartLocation: playerActor ? (locationMap[playerActor.location_id] ?? "unknown") : "unplaced",
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