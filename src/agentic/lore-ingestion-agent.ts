"use server";

// src/agentic/lore-ingestion-agent.ts
//
// The Lore Ingestion Agent is the first thing that runs when a new world is set up.
// It reads a markdown lore bible and:
//   1. Extracts structured entities (characters, factions, locations, items)
//   2. Infers relationships between them
//   3. Writes lore_node records and lore_relation edges to SurrealDB
//   4. Returns a full IngestionReport for the UI to display
//
// This is a multi-pass pipeline:
//   Pass 1 — Chunker: split markdown into logical sections
//   Pass 2 — Extractor: LLM extracts entities from each chunk as structured JSON
//   Pass 3 — Relator: LLM infers cross-entity relationships
//   Pass 4 — Writer: SurrealDB writes for all nodes + edges
//   Pass 5 — Validator: Curator agent reviews the graph for gaps

import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { getDB } from "~/libs/surreal";
import {
    LoreNode,
    IngestionChunk,
    IngestionReport,
    WrittenNode,
    WrittenEdge,
    LoreKind,
    ParsedGameInfo,
    PlayerCharacterTemplate,
    IngestionProgress
} from "~/libs/types";
import { parsePlayerCharacterSection, upsertPlayerCharacterTemplate } from "~/libs/player-character";
import { Table, StringRecordId } from "surrealdb";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// ── Game Info section parser ───────────────────────────────────────────────
// Reads the optional ## Game Info section from the lore bible.
// These values pre-fill the World Forge form and get saved to the game record.
// All fields are optional — the world-builder can set them in the Forge UI
// instead if they prefer.

export function parseGameInfoSection(markdown: string): ParsedGameInfo {
    const result: ParsedGameInfo = {};
    for (const raw of markdown.split("\n")) {
        const line = raw.trim();
        const m = line.match(/^[-*]?\s*\*\*(.+?)\*\*\s*[:\-]\s*(.*)$/);
        if (!m) continue;
        const key = m[1].toLowerCase().replace(/\s+/g, "_");
        const value = m[2].trim();
        switch (key) {
            case "description": result.description = value; break;
            case "genre": result.genre = value; break;
            case "cost_tier":
            case "tier": {
                const t = value.toLowerCase();
                if (t === "free" || t === "paid" || t === "premium") result.cost_tier = t;
                break;
            }
            case "price":
            case "cost": {
                // Accept "$1.99", "1.99", "199" (cents), "0"
                const stripped = value.replace(/[$,]/g, "");
                const num = parseFloat(stripped);
                if (!isNaN(num)) {
                    // If value looks like a dollar amount (has decimal or is < 100), convert to cents
                    result.cost = stripped.includes(".") ? Math.round(num * 100) : Math.round(num);
                }
                break;
            }
            case "tags": {
                result.tags = value.split(",").map(t => t.trim()).filter(Boolean);
                break;
            }
        }
    }
    return result;
}

// ── Pass 1: Chunker ────────────────────────────────────────────────────────
// Pure markdown parsing — no LLM needed here

export function chunkLoreBible(markdown: string): IngestionChunk[] {
    const chunks: IngestionChunk[] = [];
    const lines = markdown.split("\n");

    let currentSection = "Overview";          // tracks the ## parent
    let currentHeading = "Overview";          // tracks the active heading (## or ###)
    let currentLines: string[] = [];
    let currentSectionType: IngestionChunk["sectionType"] = "overview";

    const sectionTypeMap: Record<string, IngestionChunk["sectionType"]> = {
        overview: "overview",
        character: "characters",
        characters: "characters",
        faction: "factions",
        factions: "factions",
        location: "locations",
        locations: "locations",
        item: "items",
        items: "items",
        concept: "concepts",
        concepts: "concepts",
        event: "events",
        events: "events",
        history: "history",
        secret: "history",
        secrets: "history",
        lore: "history",
        "player character": "player_character",
        "player_character": "player_character",
        protagonist: "player_character",
        "game info": "game_info",
        "game information": "game_info",
        metadata: "game_info",
    };

    function getSectionType(heading: string): IngestionChunk["sectionType"] {
        const lower = heading.toLowerCase();
        return Object.entries(sectionTypeMap).find(([key]) =>
            lower.includes(key)
        )?.[1] ?? "other";
    }

    function flushChunk() {
        const content = currentLines.join("\n").trim();
        if (content.length < 20) return;
        chunks.push({ heading: currentHeading, content, sectionType: currentSectionType });
    }

    for (const line of lines) {
        if (line.startsWith("# ")) {
            // Skip top-level # headers — they're document titles, not lore sections
            continue;
        } else if (line.startsWith("## ")) {
            flushChunk();
            currentSection = line.replace("## ", "").trim();
            currentHeading = currentSection;
            currentSectionType = getSectionType(currentSection);
            currentLines = [];
        } else if (line.startsWith("### ")) {
            flushChunk();
            // ### sub-sections inherit the parent ## section type.
            // When inside ## Player Characters, each ### becomes its own
            // player_character chunk so pre-built characters are parsed individually.
            currentHeading = line.replace("### ", "").trim();
            currentSectionType = getSectionType(currentSection);
            currentLines = [];
        } else {
            currentLines.push(line);
        }
    }
    flushChunk();

    return chunks;
}

// ── Pass 2: Extractor Tool (used by ingestion agent) ──────────────────────

const extractEntitiesTool = createTool({
    id: "extract_lore_entities",
    description: "Extract structured lore entities from a markdown text chunk",
    inputSchema: z.object({
        chunk: z.string().describe("The markdown chunk to extract from"),
        sectionType: z.string().describe("The type of section: characters|factions|locations|items|history|concepts|events|other"),
        existingEntityNames: z.array(z.string()).describe("Already-known entity names to avoid duplication"),
    }),
    execute: async ({ chunk, sectionType, existingEntityNames }) => {
        // This tool is called by the agent internally — it returns the raw text
        // for the agent to parse. The actual LLM call happens in the agent's
        // generate() loop.
        return {
            chunk: chunk,
            sectionType: sectionType,
            existingEntityNames: existingEntityNames,
        };
    },
});

const writeLoreNodeTool = createTool({
    id: "write_lore_node",
    description: "Write a single lore node to SurrealDB. Returns the created node ID.",
    inputSchema: z.object({
        name: z.string(),
        kind: z.enum(["character", "faction", "location", "item", "event", "concept"]),
        description: z.string(),
        aliases: z.array(z.string()).default([]),
        properties: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ name, kind, description, aliases, properties }) => {
        const db = await getDB();

        // Check for existing node with same name (case-insensitive)
        const normalize = (s: string) => s.toLowerCase().replace(/^the\s+/i, "").trim();
        const normalizedName = normalize(name);

        const [existing] = await db.query<[LoreNode[]]>(
            `SELECT * FROM lore_node WHERE
       string::lowercase(name) = string::lowercase($name)
       OR string::lowercase(string::replace(name, 'The ', '')) = $normalized
       OR string::replace(string::lowercase($name), 'the ', '') = string::lowercase(string::replace(name, 'The ', ''))
       LIMIT 1`,
            { name, normalized: normalizedName }
        );

        if (existing && existing.length > 0) {
            return { id: String(existing[0].id), name, status: "existing" };
        }

        const [created] = await db.create<LoreNode>(new Table("lore_node")).content({
            kind,
            name,
            description,
            canon: true,
            properties: {
                ...properties,
                aliases,
                source: "lore_bible_ingestion",
            },
        });

        return { id: String(created.id), name, status: "created" };
    },
});

const writeLoreRelationTool = createTool({
    id: "write_lore_relation",
    description: "Write a directed relationship edge between two lore nodes in SurrealDB",
    inputSchema: z.object({
        fromName: z.string().describe("Name of the source lore node"),
        toName: z.string().describe("Name of the target lore node"),
        relationType: z.string().describe("e.g. owns, knows, located_in, allied_with, opposes, seeks, part_of, created_by"),
        weight: z.number().min(0).max(1).default(0.7),
        evidence: z.string().describe("Brief quoted evidence from the lore bible"),
        bidirectional: z.boolean().default(false),
    }),
    execute: async ({ fromName, toName, relationType, weight, evidence, bidirectional }) => {
        const db = await getDB();

        const normalizeName = (s: string) => s.toLowerCase().replace(/^the\s+/i, "").trim();

        const resolveName = async (name: string) => {
            const [rows] = await db.query<[LoreNode[]]>(
                `SELECT id FROM lore_node WHERE
           string::lowercase(name) = string::lowercase($name)
           OR string::lowercase(string::replace(name, 'The ', '')) = $normalized
           LIMIT 1`,
                { name, normalized: normalizeName(name) }
            );
            return rows?.[0] ? String(rows[0].id) : null;
        };

        const fromId = await resolveName(fromName);
        const toId = await resolveName(toName);

        if (!fromId) return { error: `Node not found: ${fromName}` };
        if (!toId) return { error: `Node not found: ${toName}` };

        const fromRid = new StringRecordId(fromId);
        const toRid = new StringRecordId(toId);

        await db.query(
            `RELATE $from->lore_relation->$to SET
       relation_type = $type,
       weight = $weight,
       metadata = { evidence: $evidence, bidirectional: $bidirectional }`,
            { from: fromRid, to: toRid, type: relationType, weight, evidence, bidirectional }
        );

        if (bidirectional) {
            await db.query(
                `RELATE $from->lore_relation->$to SET
           relation_type = $type,
           weight = $weight,
           metadata = { evidence: $evidence, bidirectional: true }`,
                { from: toRid, to: fromRid, type: relationType, weight, evidence }
            );
        }

        return { from: fromId, to: toId, type: relationType, status: "created" };
    },
});

// ── Ingestion Agent ────────────────────────────────────────────────────────

export function buildIngestionAgent(): Agent {
    return new Agent({
        id: "lore-ingestion-agent",
        name: "lore-ingestion-agent",
        model: openrouter("minimax/minimax-m2.7", {
            extraBody: {
                temperature: 1,
                reasoning: {
                    enabled: true
                }
            }
        }),
        instructions: `

CRITICAL RULES — READ BEFORE WRITING ANYTHING:
- Use the EXACT names from the lore bible. Do not paraphrase, rename, or combine entities.
- Every named entity gets its own lore_node — characters, factions, locations, items, concepts, events.
- Do not skip any named entity with a ### heading. Do not stop early. Write every single one.
- Descriptions must be grounded in what the text says, not invented.

You are the Lore Ingestion Agent for the ACE Narrative Engine.
Your job is to read structured markdown lore bibles and build a knowledge graph in SurrealDB.
 
After writing ALL nodes and relations, respond with a brief summary.

You have three tools:
1. write_lore_node — create a node for each entity (character, faction, location, item, concept, event)
2. write_lore_relation — create directed edges between nodes
3. extract_lore_entities — inspect a chunk before writing

PROCESS:
- For each entity you identify, call write_lore_node immediately
- After writing all nodes, systematically call write_lore_relation for every relationship you can identify
- Be thorough with relationships — include: owns, knows, located_in, allied_with, opposes, seeks, part_of, mentored_by, indebted_to, connected_to, guards, contains
- Infer implicit relationships, not just explicit ones (e.g. if character A and B are both in faction C, they are "allied_with" each other)
- Weight relationships by narrative importance: 1.0 = central to the story, 0.3 = peripheral
- Write ALL entities before writing ANY relations

ENTITY KINDS:
- character: named individuals
- faction: organizations, groups, cults, institutions  
- location: places, districts, buildings, regions
- item: objects, artifacts, relics, tools
- concept: philosophical ideas and abstract things that beliefs are formed around in short, simple declarative statements like: 
        - "Freedom is the absence of control."
        - "Love is nothing without sacrifice."
        - "War is necessary for progress."
- event: named events, occurrences, incidents

PROPERTIES TO EXTRACT per entity kind:
- character: role, faction, secrets, status (alive/missing/unknown)
- faction: goal, base_location, strength, weakness, infiltrated_by
- location: description, controlled_by, connections, secrets, accessible, region
- item: owner, abilities, special_properties
- concept: significance, who_knows_about_it
- event: significance, who_knows_about_it

Be exhaustive. Every named entity deserves a node. Every stated or implied relationship deserves an edge.


    `.trim(),
        tools: {
            write_lore_node: writeLoreNodeTool,
            write_lore_relation: writeLoreRelationTool,
            extract_lore_entities: extractEntitiesTool,
        },
    });
}

// ── Main Ingestion Pipeline ────────────────────────────────────────────────
// Runs both phases: Lore Graph ingestion → World Graph initialization

export async function ingestLoreBible(
    markdownContent: string,
    sourceFileName: string,
    onProgress?: (update: IngestionProgress) => void
): Promise<IngestionReport> {
    const warnings: string[] = [];
    const nodesWritten: WrittenNode[] = [];
    const edgesWritten: WrittenEdge[] = [];

    // ── PHASE 1: Chunk ────────────────────────────────────────────────────────
    onProgress?.({ phase: "chunking", message: "Splitting lore bible into sections…", percent: 5 });
    const chunks = chunkLoreBible(markdownContent);
    onProgress?.({ phase: "chunking", message: `Found ${chunks.length} sections`, percent: 10 });

    // Detect ## Game Info section — parse immediately, no LLM needed
    const gameInfoChunk = chunks.find(c => c.sectionType === "game_info");
    const parsedGameInfo: ParsedGameInfo | null = gameInfoChunk
        ? parseGameInfoSection(gameInfoChunk.content)
        : null;

    // Detect ## Player Character section(s) — parse immediately, no LLM needed
    // Each ### sub-section under ## Player Characters becomes its own chunk
    const playerCharChunks = chunks.filter(c => c.sectionType === "player_character");
    let playerCharacterTemplates: PlayerCharacterTemplate[] = [];

    // Note to lore agent if a player character section exists
    const playerCharNote = playerCharChunks.length > 0
        ? `\nNOTE: There is a ## Player Character section. Extract the character as kind="character" with properties.is_player_character=true. Do NOT invent backstory options — the player character template is handled separately.`
        : "";

    // Exclude meta-sections — handled by their own parsers
    // fullContext removed: we now process chunks individually in Phase 2

    // ── PHASE 2: Lore ingestion agent ─────────────────────────────────────────
    // Process each chunk individually so the agent focuses on one entity at a time.
    // This prevents the model from stopping early after processing the first few entities.

    const loreChunks = chunks.filter(
        c => c.sectionType !== "game_info" && c.sectionType !== "player_character"
    );

    onProgress?.({ phase: "extracting", message: `Lore Ingestion Agent processing ${loreChunks.length} sections…`, percent: 15 });

    const loreAgent = buildIngestionAgent();
    let loreAgentResponse = { text: "" };

    for (let i = 0; i < loreChunks.length; i++) {
        const chunk = loreChunks[i];
        const percent = Math.round(15 + (i / loreChunks.length) * 33);
        onProgress?.({ phase: "extracting", message: `Extracting: ${chunk.heading}…`, percent });

        const result = await loreAgent.generate([
            {
                role: "user",
                content: `
Extract lore entities from this ${chunk.sectionType} section of the lore bible.
 
SECTION: ${chunk.heading} [${chunk.sectionType}]
${i === 0 ? playerCharNote : ""}
 
CONTENT:
${chunk.content}
 
CRITICAL RULES:
- Use the EXACT names as written. Do not paraphrase, rename, or combine.
- Write ONE lore_node for the PRIMARY entity this section is about (the ### heading).
- Do NOT create nodes for secondary entities written IN the description field or properties of the PRIMARY entity — they will get their own dedicated section.
- Write lore_relations using the exact names of entities (they don't need to exist yet).
- Descriptions must quote or closely paraphrase what the text says.
- kind must be one of: character, faction, location, item, concept, event
      `.trim(),
            },
        ], {
            maxSteps: 200,
        });
        // Keep the last response text as the summary
        loreAgentResponse = result;
    }

    onProgress?.({ phase: "extracting", message: "Lore agent finished — collecting results…", percent: 48 });

    // Collect lore results
    const db = await getDB();
    const [allLoreNodes] = await db.query<[LoreNode[]]>(
        `SELECT id, name, kind, description, properties FROM lore_node`
    );
    const [allLoreEdges] = await db.query<[any[]]>(
        `SELECT in, out, relation_type FROM lore_relation`
    );

    for (const node of (allLoreNodes ?? [])) {
        nodesWritten.push({ surreal_id: String(node.id), name: node.name, kind: node.kind as LoreKind });
    }
    for (const edge of (allLoreEdges ?? [])) {
        edgesWritten.push({ from: String(edge.in), to: String(edge.out), type: edge.relation_type });
    }

    // ── Write player character template(s) to DB ─────────────────────────
    // Each ### sub-section under ## Player Characters produces its own template
    for (const playerCharChunk of playerCharChunks) {
        const parsed = parsePlayerCharacterSection(playerCharChunk.content);

        // Find the lore_node that was written for this character (if any)
        const pcLoreNode = (allLoreNodes ?? []).find(
            n => n.properties?.is_player_character === true ||
                n.name.toLowerCase() === parsed.base_name.toLowerCase()
        );

        // game_id will be stamped by the calling route (ingest.ts) which has it
        // kind and status come from the parsed markdown (e.g. **Kind**: prebuilt)
        const template = await upsertPlayerCharacterTemplate({
            game_id: "PENDING",  // overwritten by ingest.ts after this returns
            ...parsed,
            lore_node_id: pcLoreNode ? String(pcLoreNode.id) : null,
        });
        playerCharacterTemplates.push(template);
    }

    // ── PHASE 3: Curator validation of Lore Graph ────────────────────────────
    onProgress?.({ phase: "validating", message: "Curator reviewing lore graph for gaps…", percent: 52 });

    const curator = new Agent({
        id: "lore-curator-validator",
        name: "lore-curator-validator",
        model: openrouter("minimax/minimax-m2.7"),
        instructions: "You are a lore curator. Review ingestion results and flag obvious gaps.",
        tools: {},
    });

    const curatorResponse = await curator.generate([{
        role: "user",
        content: `
Review this lore ingestion result.
Nodes: ${nodesWritten.map((n) => `${n.name} (${n.kind})`).join(", ")}
Relations: ${edgesWritten.length}
 
Flag gaps: entities mentioned but not created, likely-missed relationships.
One sentence per warning. If all looks correct, say "No issues found."
    `.trim(),
    }]);

    const curatorText = curatorResponse.text;
    if (!curatorText.toLowerCase().includes("no issues")) {
        curatorText.split("\n").filter(l => l.trim().length > 0).forEach(w => warnings.push(w.trim()));
    }

    // ── PHASE 4: World Graph initialization ───────────────────────────────────
    onProgress?.({ phase: "world_init", message: "World Init Agent placing actors, locations, items…", percent: 58 });

    // Lazy-import to avoid circular reference
    const { initializeWorldGraph } = await import("./world-init-agent");

    console.log("[world-init] starting with", allLoreNodes?.length, "lore nodes");
    const worldReport = await initializeWorldGraph(
        loreAgentResponse.text,
        allLoreNodes ?? [],
        onProgress
    );
    console.log("[world-init] complete", worldReport.warnings);
    warnings.push(...worldReport.warnings);

    // ── PHASE 5: Record init state ────────────────────────────────────────────
    onProgress?.({ phase: "world_init", message: "Finalizing…", percent: 94 });

    await db.create(new Table("world_init")).content({
        source_file: sourceFileName,
        lore_nodes: nodesWritten.length,
        lore_edges: edgesWritten.length,
        world_agents: worldReport.agentsPlaced.length,
        world_locations: worldReport.locationsCreated.length,
        world_items: worldReport.itemsPlaced.length,
        world_concepts: worldReport.conceptsCreated.length,
        world_events: worldReport.eventsCreated.length,
        world_threads: worldReport.threadsOpened.length,
    });

    onProgress?.({ phase: "complete", message: "Both graphs initialized — world ready", percent: 100 });

    return {
        sourceFile: sourceFileName,
        chunksProcessed: chunks.length,
        entitiesExtracted: [],
        relationsExtracted: [],
        nodesWritten,
        edgesWritten,
        warnings,
        summary: loreAgentResponse.text,
        worldReport,
        playerCharacterTemplate: playerCharacterTemplates[0] ?? null,
        gameInfo: parsedGameInfo,
        completedAt: new Date().toISOString(),
    };
}