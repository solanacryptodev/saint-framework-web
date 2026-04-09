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
//   Pass 1 — Chunker: split markdown into logical sections + parse metadata
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
                const stripped = value.replace(/[$,]/g, "");
                const num = parseFloat(stripped);
                if (!isNaN(num)) {
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

// ── Metadata Parser ────────────────────────────────────────────────────────
// FIX: New function. Extracts structured key-value metadata from markdown.
//
// Handles five patterns found in lore bibles:
//   1. **Key**: value                    → { key: "value" }
//   2. **Key**: val, **Key2**: val2      → { key: "val", key2: "val2" }
//   3. **Key**: value\n  continuation    → { key: "value continuation" }
//   4. - **Key**: value                  → { key: "value" } (from list items)
//   5. - plain item                      → aliases or items array
//
// Free text (not matching any pattern) → description.
// This runs at chunk time so the agent gets clean structured data.

export function parseMetadataFromContent(content: string): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    const descriptionLines: string[] = [];
    let lastMetaKey: string | null = null;

    for (const raw of content.split("\n")) {
        const line = raw.trim();
        if (!line) continue;

        // ── Pattern 1 & 2: **Key**: value (one or many per line) ──
        const boldMetaMatches = [...line.matchAll(/\*\*([^*]+)\*\*\s*:\s*(.+?)(?=\s*\*\*[^*]+\*\*:|$)/g)];

        if (boldMetaMatches.length > 0) {
            for (const match of boldMetaMatches) {
                const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
                const value = match[2].trim().replace(/,\s*$/, "");

                if (metadata[key] !== undefined) {
                    if (Array.isArray(metadata[key])) {
                        (metadata[key] as string[]).push(value);
                    } else {
                        metadata[key] = [metadata[key] as string, value];
                    }
                } else {
                    metadata[key] = value;
                }
                lastMetaKey = key;
            }
            continue;
        }

        // ── Pattern 3: Continuation of a multi-line metadata value ──
        // If the previous line was **Key**: value and this line is plain text
        // (not a heading, not a list item, not another metadata line), append it.
        if (lastMetaKey && !line.startsWith("#") && !line.startsWith("- ")) {
            const existing = metadata[lastMetaKey];
            if (typeof existing === "string") {
                metadata[lastMetaKey] = existing + " " + line;
            }
            continue;
        }

        // ── Reset continuation tracker if we hit a non-continuation line ──
        lastMetaKey = null;

        // ── Pattern 4: List items with bold key-value labels ──
        // e.g. "- **Defector**: You crossed from the other side..."
        // These become metadata entries grouped under the list key.
        if (line.startsWith("- ") || line.startsWith("* ")) {
            const item = line.replace(/^[-*]\s+/, "").trim();
            const kvMatch = item.match(/^\*\*([^*]+)\*\*\s*:\s*(.+)$/);

            if (kvMatch) {
                const key = kvMatch[1].trim().toLowerCase().replace(/\s+/g, "_");
                const value = kvMatch[2].trim();

                if (metadata[key] !== undefined) {
                    if (Array.isArray(metadata[key])) {
                        (metadata[key] as string[]).push(value);
                    } else {
                        metadata[key] = [metadata[key] as string, value];
                    }
                } else {
                    metadata[key] = value;
                }
            } else {
                // Pattern 5: Plain list item (no bold label)
                if (!metadata._list_items) metadata._list_items = [];
                (metadata._list_items as string[]).push(item);
            }
            continue;
        }

        // ── Free text → description ──
        descriptionLines.push(line);
    }

    // Assemble description from free-text lines
    if (descriptionLines.length > 0) {
        metadata.description = descriptionLines.join(" ").trim();
    }

    // Clean up internal-only keys and classify list items
    const listItems = metadata._list_items;
    delete metadata._list_items;

    if (Array.isArray(listItems) && listItems.length > 0) {
        // If all items are short and have no colons, they're likely aliases
        const allShort = listItems.every(i => i.length < 60 && !i.includes(":"));
        if (allShort) {
            metadata.aliases = listItems;
        } else {
            // Otherwise they're structured sub-items (abilities, traits, etc.)
            metadata.items = listItems;
        }
    }

    return metadata;
}

// ── Pass 1: Chunker ────────────────────────────────────────────────────────
// FIX: Added ParsedChunk interface with parsedMetadata field.
// FIX: Section type is now captured BEFORE updating on ## headers
//      (previously the last chunk before a ## heading inherited the NEW section's type).
// FIX: Metadata is pre-parsed at chunk time so the agent gets structured data.

export interface ParsedChunk extends IngestionChunk {
    parsedMetadata: Record<string, unknown>;
}

export function chunkLoreBible(markdown: string): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    const lines = markdown.split("\n");

    let currentSection = "Overview";
    let currentHeading = "Overview";
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
        "player characters": "player_character",
        "player_character": "player_character",
        "player_characters": "player_character",
        operative: "player_character",
        operatives: "player_character",
        protagonist: "player_character",
        "game info": "game_info",
        "game information": "game_info",
        metadata: "game_info",
    };

    function getSectionType(heading: string): IngestionChunk["sectionType"] {
        const lower = heading.toLowerCase();
        // Sort by key length descending so more-specific keys (e.g. "player characters")
        // are tested before shorter substring matches (e.g. "characters").
        // Without this, getSectionType("Player Characters") matches "characters" first
        // and never reaches the "player characters" entry.
        const sorted = Object.entries(sectionTypeMap).sort(([a], [b]) => b.length - a.length);
        return sorted.find(([key]) => lower.includes(key))?.[1] ?? "other";
    }

    function flushChunk() {
        const content = currentLines.join("\n").trim();
        if (content.length < 20) return;
        const parsedMetadata = parseMetadataFromContent(content);
        chunks.push({
            heading: currentHeading,
            content,
            sectionType: currentSectionType,
            parsedMetadata,
        });
    }

    for (const line of lines) {
        if (line.startsWith("# ")) {
            // Skip top-level # headers — they're document titles
            continue;
        } else if (line.startsWith("## ")) {
            // FIX: Capture section type BEFORE flush, so the outgoing chunk
            // keeps its own type instead of inheriting the new ## heading's type.
            const newHeading = line.replace("## ", "").trim();
            const newSectionType = getSectionType(newHeading);
            flushChunk();
            currentSection = newHeading;
            currentHeading = newHeading;
            currentSectionType = newSectionType;
            currentLines = [];
        } else if (line.startsWith("### ")) {
            flushChunk();
            currentHeading = line.replace("### ", "").trim();
            // sectionType stays the same — ### inherits from ## parent
            currentLines = [];
        } else {
            currentLines.push(line);
        }
    }
    flushChunk();

    return chunks;
}

// ── Pass 2: Tools ──────────────────────────────────────────────────────────

const extractEntitiesTool = createTool({
    id: "extract_lore_entities",
    description: "Inspect a chunk before writing. Returns chunk content, pre-parsed metadata, and existing entity names for deduplication.",
    inputSchema: z.object({
        chunk: z.string().describe("The markdown chunk to extract from"),
        sectionType: z.string().describe("The type of section"),
        existingEntityNames: z.array(z.string()).describe("Already-known entity names to avoid duplication"),
    }),
    execute: async ({ chunk, sectionType, existingEntityNames }) => {
        return { chunk, sectionType, existingEntityNames };
    },
});

const writeLoreNodeTool = createTool({
    id: "write_lore_node",
    description: "Write ONE lore node for the PRIMARY entity of a section (the heading). Do NOT use this for entities merely mentioned in metadata — use write_lore_relation for those.",
    inputSchema: z.object({
        name: z.string().describe("EXACT name from the heading — do not paraphrase"),
        kind: z.enum(["character", "faction", "location", "item", "event", "concept"]),
        description: z.string().describe("Grounded description from the lore bible text"),
        aliases: z.array(z.string()).default([]),
        properties: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ name, kind, description, aliases, properties }) => {
        const db = await getDB();

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
    description: "Write a directed relationship edge between two lore nodes. Both nodes are resolved by name (case-insensitive). Use this to connect the primary entity to other entities mentioned in its metadata.",
    inputSchema: z.object({
        fromName: z.string().describe("Name of the source lore node"),
        toName: z.string().describe("Name of the target lore node"),
        relationType: z.string().describe("e.g. owns, knows, located_in, allied_with, opposes, seeks, part_of, mentored_by, indebted_to, connected_to, guards, contains, serves, created_by, member_of, leads, protects, fears, trained_by"),
        weight: z.number().min(0).max(1).default(0.7),
        evidence: z.string().describe("Brief quoted evidence from the lore bible"),
        bidirectional: z.boolean().default(false),
    }),
    execute: async ({ fromName, toName, relationType, weight, evidence, bidirectional }) => {
        const db = await getDB();

        const resolveName = async (name: string) => {
            const normalizedName = name
                .toLowerCase()
                .replace(/^(the|a|an)\s+/i, "")
                .trim();

            const [rows] = await db.query<[LoreNode[]]>(
                `SELECT id FROM lore_node WHERE
           string::lowercase(name) = string::lowercase($name)
           OR string::lowercase(string::replace(name, 'The ', '')) = $normalized
           OR string::lowercase(string::replace(name, 'the ', '')) = $normalized
           LIMIT 1`,
                { name, normalized: normalizedName }
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
                `RELATE $to->lore_relation->$from SET
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
// FIX: Completely rewritten instructions. The old prompt contradicted itself —
// said "one node per section" in one place and "every named entity deserves a node"
// elsewhere. Now it's unambiguous with a concrete example.

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

You are the Lore Ingestion Agent for the ACE Narrative Engine.
Your job is to read structured markdown lore bible sections and build a knowledge graph in SurrealDB.

You have three tools:
1. write_lore_node — create ONE node for the PRIMARY entity (the heading of the section)
2. write_lore_relation — create directed edges between nodes
3. extract_lore_entities — inspect a chunk before writing

═══════════════════════════════════════════════════════════════════
THE FUNDAMENTAL RULE: ONE NODE PER HEADING
═══════════════════════════════════════════════════════════════════

Each section has exactly ONE primary entity — the one named in its heading.
Everything else in the section is METADATA for that primary entity.

The metadata is already parsed for you. You receive it as a structured list.
Use it directly as node properties. Do NOT re-parse the raw markdown.

Example:

  ### Director Harlan Voss
  **Location**: The Vienna Safe House
  **Relationships**: Commands all Agency personnel in Vienna. Distrusts the new counter-intelligence liaison. Has a professional understanding with Marta Szabo that predates the current mission.
  Station Chief, Vienna. Sixty-one years old. The kind of man who looks like he was born in a grey suit...

  → write_lore_node(
      name="Director Harlan Voss",
      kind="character",
      description="Station Chief, Vienna. Sixty-one years old. The kind of man who looks like he was born in a grey suit...",
      properties={
        location: "The Vienna Safe House",
        relationships: "Commands all Agency personnel in Vienna. Distrusts the new counter-intelligence liaison. Has a professional understanding with Marta Szabo that predates the current mission."
      }
    )

  → write_lore_relation(fromName="Director Harlan Voss", toName="The Vienna Safe House", relationType="located_in", ...)
  → write_lore_relation(fromName="Director Harlan Voss", toName="Marta Szabo", relationType="connected_to", ...)

  → Do NOT write_lore_node for "The Vienna Safe House" or "Marta Szabo" here.
    They have their own ### headings in their own sections.

═══════════════════════════════════════════════════════════════════
DEDUPLICATION
═══════════════════════════════════════════════════════════════════

Before writing a node, CHECK the "Already created entities" list in the prompt.
If the entity is already listed, skip to writing relationships only.
Do NOT create a duplicate. The database also enforces uniqueness, but
checking the list is faster and prevents confusing tool call errors.

═══════════════════════════════════════════════════════════════════
PROCESS PER CHUNK
═══════════════════════════════════════════════════════════════════

For each chunk you receive:

1. Read the heading. This is the PRIMARY ENTITY name.
2. Read the PARSED METADATA. These become node properties.
3. Read the DESCRIPTION (if present). This is the node description.
4. If the primary entity is NOT in the "Already created" list:
   → Call write_lore_node ONCE with the exact heading name, correct kind,
     description, and ALL parsed metadata as properties.
5. Read the RAW CONTENT for relationship extraction.
6. For EVERY other named entity mentioned in the metadata or content:
   → Call write_lore_relation to create an edge.
   → Use the exact name as it appears in the text.
   → The tool resolves names case-insensitively.
   → It's okay if the target node doesn't exist yet — the tool will
     resolve it when it does. Just use the correct name.

═══════════════════════════════════════════════════════════════════
PROPERTIES TO EXTRACT (from the pre-parsed metadata)
═══════════════════════════════════════════════════════════════════

Use EVERY key from the parsed metadata as a property. Common ones:

- character: role, faction, location, status, secrets, items, abilities, traits,
  fixed_traits, starting_items, relationships
- faction: base, leader, status, known_to_player, concepts_championed,
  controlled_by, strength, weakness, infiltrated_by
- location: region, accessible, traversal_risk, atmosphere, secrets,
  controlled_by, concept_imprint
- item: kind, narrative_weight, gravitational_mass, concept_affinity,
  concept_transfer, known_to_player, plausibility_anchor, owner, origin
- concept: feeling, story_fuel, known_to_player_at_start, significance
- event: significance, long_shadow, ideas_spawned, known_to_player_at_start

Also capture free-text descriptions that appear after metadata lines.

═══════════════════════════════════════════════════════════════════
RELATIONSHIP TYPES
═══════════════════════════════════════════════════════════════════

Be thorough. Use these relation types:
  owns, knows, located_in, allied_with, opposes, seeks, part_of, mentored_by,
  indebted_to, connected_to, guards, contains, serves, created_by, member_of,
  leads, protects, fears, trained_by, commands, controls, uses, seeks

Infer implicit relationships:
  - If A and B are both in faction C → A allied_with B
  - If A owns item B created by C → A connected_to C
  - If faction A opposes faction B and character C is in A → C opposes B
  - If location A has concept_imprint mentioning concept B → A connected_to B

Weight by narrative importance: 1.0 = central, 0.5 = moderate, 0.3 = peripheral

After writing ALL nodes and relations for a chunk, move to the next chunk.
Do not stop early. Process every chunk.

    `.trim(),
        tools: {
            write_lore_node: writeLoreNodeTool,
            write_lore_relation: writeLoreRelationTool,
            extract_lore_entities: extractEntitiesTool,
        },
    });
}

// ── Main Ingestion Pipeline ────────────────────────────────────────────────

export async function ingestLoreBible(
    markdownContent: string,
    sourceFileName: string,
    gameId: string,
    onProgress?: (update: IngestionProgress) => void
): Promise<IngestionReport> {
    const warnings: string[] = [];
    const nodesWritten: WrittenNode[] = [];
    const edgesWritten: WrittenEdge[] = [];

    // ── PHASE 1: Chunk + parse metadata ──────────────────────────────────────
    onProgress?.({ phase: "chunking", message: "Splitting lore bible into sections…", percent: 5 });
    const chunks = chunkLoreBible(markdownContent);
    onProgress?.({ phase: "chunking", message: `Found ${chunks.length} sections`, percent: 10 });

    const gameInfoChunk = chunks.find(c => c.sectionType === "game_info");
    const parsedGameInfo: ParsedGameInfo | null = gameInfoChunk
        ? parseGameInfoSection(gameInfoChunk.content)
        : null;

    const playerCharChunks = chunks.filter(c => c.sectionType === "player_character");
    let playerCharacterTemplates: PlayerCharacterTemplate[] = [];

    // ── PHASE 2: Lore ingestion agent ────────────────────────────────────────
    // FIX: Process each chunk individually with structured metadata context.
    // FIX: Track created entity names across chunks for deduplication.
    // FIX: Pass pre-parsed metadata in the prompt so the agent doesn't re-parse.

    const loreChunks = chunks.filter(
        c => c.sectionType !== "game_info" && c.sectionType !== "player_character"
    );

    onProgress?.({ phase: "extracting", message: `Lore Ingestion Agent processing ${loreChunks.length} sections…`, percent: 15 });

    const loreAgent = buildIngestionAgent();
    let loreAgentResponse = { text: "" };

    // FIX: Track entity names across chunks so the agent avoids duplicates.
    // When Agent Cipher's section mentions "The Prague Compromise" (already created
    // as an event), the agent sees it in this list and writes a relation instead
    // of trying to create a duplicate node.
    const createdEntityNames: string[] = [];

    // Get DB connection before the loop — needed for the metadata patch step.
    const db = await getDB();

    for (let i = 0; i < loreChunks.length; i++) {
        const chunk = loreChunks[i];
        const percent = Math.round(15 + (i / loreChunks.length) * 33);
        onProgress?.({ phase: "extracting", message: `Extracting: ${chunk.heading}…`, percent });

        // Fix 5 — Verify parseMetadataFromContent is actually producing keys.
        // If every chunk shows EMPTY, the content passed to chunkLoreBible is
        // not matching the bold-key patterns expected by parseMetadataFromContent.
        console.log(`[chunk] "${chunk.heading}" → parsedMetadata keys: ${Object.keys(chunk.parsedMetadata).join(', ') || 'EMPTY'}`);

        // FIX: Build structured metadata summary from pre-parsed data.
        const metadataEntries = Object.entries(chunk.parsedMetadata)
            .filter(([key]) => key !== "description")
            .map(([key, value]) => {
                const displayKey = key.replace(/_/g, " ");
                if (Array.isArray(value)) {
                    return `- **${displayKey}**:\n${value.map(v => `  - ${v}`).join("\n")}`;
                }
                return `- **${displayKey}**: ${value}`;
            })
            .join("\n");

        const description = chunk.parsedMetadata.description as string | undefined;

        const result = await loreAgent.generate([
            {
                role: "user",
                content: `
Extract lore entities from this ${chunk.sectionType} section.

═══════════════════════════════════════
SECTION: ${chunk.heading}
KIND: ${chunk.sectionType}
═══════════════════════════════════════

Already created entities (do NOT write_lore_node for these — only write_lore_relation):
${createdEntityNames.length > 0 ? createdEntityNames.map(n => `  - ${n}`).join("\n") : "  (none yet — this is the first entity)"}

═══════════════════════════════════════
PARSED METADATA (use these as node properties):
═══════════════════════════════════════
${metadataEntries || "(no structured metadata found)"}

${description ? `DESCRIPTION:\n${description}\n` : ""}
═══════════════════════════════════════
RAW CONTENT (for relationship extraction):
═══════════════════════════════════════
${chunk.content}

═══════════════════════════════════════
INSTRUCTIONS:
═══════════════════════════════════════
1. "${chunk.heading}" is the PRIMARY ENTITY for this section.
2. ${createdEntityNames.includes(chunk.heading)
                        ? `"${chunk.heading}" is ALREADY in the "Already created" list. Do NOT call write_lore_node. Only write relationships.`
                        : `Call write_lore_node ONCE for "${chunk.heading}". Use the PARSED METADATA as properties and the DESCRIPTION as the description.`
                    }
3. For EVERY other named entity mentioned in the metadata or content, call write_lore_relation.
4. Use the exact names as written. The relation tool resolves them case-insensitively.
5. Do NOT create nodes for entities that are merely mentioned — only for the heading entity.
      `.trim(),
            },
        ], {
            maxSteps: 200,
        });

        loreAgentResponse = result;

        // ── DETERMINISTIC METADATA PATCH ─────────────────────────────────────
        // The agent is unreliable at copying parsed metadata into the properties
        // argument of write_lore_node. We patch directly after each agent call
        // using the pre-parsed metadata — no LLM fidelity required.
        //
        // Keys to exclude from properties (they live as top-level fields):
        const SKIP_KEYS = new Set(["description", "_list_items"]);
        const metaToWrite = Object.fromEntries(
            Object.entries(chunk.parsedMetadata).filter(([k]) => !SKIP_KEYS.has(k))
        );

        // Fix 3 — Log the keys we're about to write so we can distinguish
        // "no metadata was parsed" from "the UPDATE matched nothing".
        console.log(`[patch] "${chunk.heading}" → metaKeys: ${Object.keys(metaToWrite).join(', ') || 'none'}`);

        if (Object.keys(metaToWrite).length > 0) {
            try {
                // Simple case-insensitive name match — avoid complex SurrealDB
                // string functions in WHERE which can throw on edge-case names.
                const [patchRows] = await db.query<[LoreNode[]]>(
                    `SELECT id, properties FROM lore_node
                     WHERE string::lowercase(name) = string::lowercase($name)
                     LIMIT 1`,
                    { name: chunk.heading }
                );

                // Fix 3 — Log whether the SELECT found the node at all.
                console.log(`[patch] "${chunk.heading}" → node found: ${patchRows?.length ?? 0}`);

                if (patchRows?.[0]) {
                    const existing = (patchRows[0].properties as Record<string, unknown>) ?? {};

                    // Fix 2 — Interpolate the record ID directly into the query
                    // string instead of using $id parameter binding.
                    //
                    // SurrealDB 2.x does NOT reliably accept a RecordId object as
                    // a $id binding in UPDATE statements — the query either fails
                    // silently or treats the ID as a literal string and matches
                    // nothing. The record ID comes from a DB query result so
                    // interpolating it is safe: it is always in the form
                    // lore_node:abc123xyz which is a valid SurrealDB literal.
                    const recordId = String(patchRows[0].id);

                    // Fix 4 — Also stamp game_id on every node so the Witness
                    // queries only the current game instead of all games.
                    await db.query(
                        `UPDATE ${recordId} SET properties = $props, game_id = $gid, updated_at = time::now()`,
                        {
                            props: {
                                ...existing,
                                ...metaToWrite,
                                source: "lore_bible_ingestion",
                            },
                            gid: gameId,
                        }
                    );
                }
            } catch (patchErr) {
                // Fix 1 — Use console.error (not warn) so this is never
                // silently swallowed in log aggregators that filter warn.
                console.error(`[lore-ingestion] metadata patch FAILED for "${chunk.heading}":`, patchErr);
            }
        }

        // FIX: Track this entity so subsequent chunks know it exists.
        if (!createdEntityNames.includes(chunk.heading)) {
            createdEntityNames.push(chunk.heading);
        }
    }

    onProgress?.({ phase: "extracting", message: "Lore agent finished — collecting results…", percent: 48 });

    // Collect lore results
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
    for (const playerCharChunk of playerCharChunks) {
        const parsed = parsePlayerCharacterSection(playerCharChunk.content);

        // Fall back to the section heading if no **Name** field was in the body
        // (e.g. prebuilt characters like "### Operative Ghost" have no **Name**: line)
        if (!parsed.base_name || parsed.base_name === "The Protagonist") {
            parsed.base_name = playerCharChunk.heading;
        }

        const pcLoreNode = (allLoreNodes ?? []).find(
            n => n.properties?.is_player_character === true ||
                n.name.toLowerCase() === parsed.base_name.toLowerCase()
        );

        console.log(`[template] about to upsert: base_name="${parsed.base_name}" kind="${parsed.kind}" game_id="${gameId}"`);
        const template = await upsertPlayerCharacterTemplate({
            game_id: gameId,
            ...parsed,
            lore_node_id: pcLoreNode ? String(pcLoreNode.id) : undefined,
        });
        console.log(`[template] upserted successfully: id=${template.id}`);
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

Check for:
- Entities mentioned in the lore bible that don't have nodes
- Obvious missing relationships (e.g., character in faction but no member_of edge)
- Potential duplicate nodes (same entity created twice with slight name differences)
One sentence per warning. If all looks correct, say "No issues found."
    `.trim(),
    }]);

    const curatorText = curatorResponse.text;
    if (!curatorText.toLowerCase().includes("no issues")) {
        curatorText.split("\n").filter(l => l.trim().length > 0).forEach(w => warnings.push(w.trim()));
    }

    // ── PHASE 4: World Graph initialization ───────────────────────────────────
    onProgress?.({ phase: "world_init", message: "World Init Agent placing actors, locations, items…", percent: 58 });

    const { initializeWorldGraph } = await import("./world-init-agent");

    console.log("[world-init] starting with", allLoreNodes?.length, "lore nodes");
    const worldReport = await initializeWorldGraph(
        loreAgentResponse.text,
        allLoreNodes ?? [],
        gameId,
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
