"use server";

// src/libs/player-character.ts
//
// Two tables drive player character creation:
//
// player_character_template
//   Written once during lore ingestion. Stores everything the world-builder
//   defined in the ## Player Character section. This is the authoring record.
//   One per game world.
//
// player_character
//   Written when a player completes character creation before their first
//   session. Stores the player's choices against the template. One per
//   player per game session.
//
// The split means the world-builder's design is never mutated by player
// choices — player_character always references the template it was built from.

import { getDB } from "./surreal";
import { Table } from "surrealdb";
import {
    PlayerCharacterTemplate,
    PlayerCharacter,
    BackstoryOption,
    StartingItemOption,
    CharacterKind,
    CharacterStatus,
} from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

export async function upsertPlayerCharacterTemplate(
    template: Omit<PlayerCharacterTemplate, "id" | "created_at">
): Promise<PlayerCharacterTemplate> {
    const db = await getDB();

    // Upsert on game_id + base_name — allows multiple templates per game (one per character)
    const [existing] = await db.query<[PlayerCharacterTemplate[]]>(
        `SELECT * FROM player_character_template WHERE game_id = $gid AND base_name = $base_name LIMIT 1`,
        { gid: template.game_id, base_name: template.base_name }
    );

    if (existing?.[0]) {
        const [updated] = await db.query<[PlayerCharacterTemplate[]]>(
            `UPDATE $id SET
         kind = $kind, status = $status,
         description = $description,
         fixed_traits = $fixed_traits, backstory_options = $backstory_options,
         trait_options = $trait_options, item_options = $item_options,
         max_item_picks = $max_item_picks, allow_custom_name = $allow_custom_name,
         allow_portrait = $allow_portrait, starting_location = $starting_location,
         lore_node_id = $lore_node_id, raw_markdown = $raw_markdown`,
            { id: String(existing[0].id), ...template }
        );
        return updated[0];
    }

    const [created] = await db.create<PlayerCharacterTemplate>(new Table("player_character_template")).content(template);
    return created;
}

export async function getPlayerCharacterTemplate(
    gameId: string
): Promise<PlayerCharacterTemplate | null> {
    const db = await getDB();
    const [rows] = await db.query<[PlayerCharacterTemplate[]]>(
        `SELECT * FROM player_character_template WHERE game_id = $gid LIMIT 1`,
        { gid: gameId }
    );
    return rows?.[0] ?? null;
}

export async function createPlayerCharacter(
    pc: Omit<PlayerCharacter, "id" | "created_at">
): Promise<PlayerCharacter> {
    const db = await getDB();
    const [created] = await db.create<PlayerCharacter>(new Table("player_character")).content(pc);
    return created;
}

export async function getPlayerCharacter(
    sessionId: string
): Promise<PlayerCharacter | null> {
    const db = await getDB();
    const [rows] = await db.query<[PlayerCharacter[]]>(
        `SELECT * FROM player_character WHERE session_id = $sid LIMIT 1`,
        { sid: sessionId }
    );
    return rows?.[0] ?? null;
}

export async function getCharacterTemplates(
    gameId: string,
    status?: string
): Promise<PlayerCharacterTemplate[]> {
    const db = await getDB();
    const [rows] = await db.query<[PlayerCharacterTemplate[]]>(
        status
            ? `SELECT * FROM player_character_template WHERE game_id = $gid AND status = $status`
            : `SELECT * FROM player_character_template WHERE game_id = $gid`,
        { gid: gameId, status }
    );
    return rows ?? [];
}

export async function getCharacterTemplateById(
    templateId: string
): Promise<PlayerCharacterTemplate | null> {
    const db = await getDB();

    // Ensure the ID has the table prefix for direct record lookup
    const fullId = templateId.includes(':')
        ? templateId
        : `player_character_template:${templateId}`;

    const [rows] = await db.query<[PlayerCharacterTemplate[]]>(
        `SELECT * FROM type::thing('player_character_template', $id) LIMIT 1`,
        { id: templateId.includes(':') ? templateId.split(':')[1] : templateId }
    );
    return rows?.[0] ?? null;
}

export async function getPlayerCharacterForGame(
    playerId: string,
    gameId: string
): Promise<PlayerCharacter | null> {
    const db = await getDB();
    const [rows] = await db.query<[PlayerCharacter[]]>(
        `SELECT * FROM player_character WHERE player_id = $pid AND game_id = $gid ORDER BY created_at DESC LIMIT 1`,
        { pid: playerId, gid: gameId }
    );
    return rows?.[0] ?? null;
}

// ── ## Player Character section parser ───────────────────────────────────────
// Called by the lore ingestion agent after chunking.
// Parses the fixed-field markdown format the world-builder writes.

export interface ParsedPlayerCharacterSection {
    base_name: string;
    description: string;
    kind: CharacterKind;
    status: CharacterStatus;
    fixed_traits: string[];
    backstory_options: BackstoryOption[];
    trait_options: string[];
    item_options: StartingItemOption[];
    max_item_picks: number;
    allow_custom_name: boolean;
    allow_portrait: boolean;
    starting_location: string;
    raw_markdown: string;
}

export function parsePlayerCharacterSection(
    markdown: string
): ParsedPlayerCharacterSection {
    const lines = markdown.split("\n");

    let base_name = "";
    let description = "";
    let kind: CharacterKind = "template";
    let status: CharacterStatus = "published";
    let fixed_traits: string[] = [];
    let backstory_options: BackstoryOption[] = [];
    let trait_options: string[] = [];
    let item_options: StartingItemOption[] = [];
    let max_item_picks = 1;
    let allow_custom_name = true;
    let allow_portrait = true;
    let starting_location = "";

    // Track which multi-line block we're parsing
    let currentBlock: "backstory" | "traits" | "items" | "none" = "none";
    let currentBackstory: BackstoryOption | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        // Bold field: **Key**: value  or  - **Key**: value
        const fieldMatch = line.match(/^[-*]?\s*\*\*(.+?)\*\*\s*[:\-]\s*(.*)$/);

        if (fieldMatch) {
            const key = fieldMatch[1].toLowerCase().replace(/\s+/g, "_");
            const value = fieldMatch[2].trim();
            currentBlock = "none";
            if (currentBackstory) { backstory_options.push(currentBackstory); currentBackstory = null; }

            switch (key) {
                case "name":
                    base_name = value;
                    break;
                case "description":
                case "role":
                    description = value;
                    break;
                case "kind":
                    if (["template", "prebuilt", "custom"].includes(value.toLowerCase())) {
                        kind = value.toLowerCase() as CharacterKind;
                    }
                    break;
                case "status":
                    if (["draft", "published", "archived"].includes(value.toLowerCase())) {
                        status = value.toLowerCase() as CharacterStatus;
                    }
                    break;
                case "fixed":
                case "fixed_traits":
                case "fixed_abilities":
                    fixed_traits = value.split(",").map(t => t.trim()).filter(Boolean)
                        .map(t => t.replace(/^\[|\]$/g, ""));
                    break;
                case "traits":
                case "trait_options":
                    currentBlock = "traits";
                    // Inline traits: **Traits**: [A], [B], [C]
                    if (value) {
                        trait_options = value.split(",").map(t => t.trim().replace(/^\[|\]$/g, "")).filter(Boolean);
                    }
                    break;
                case "backstory_options":
                case "backstory":
                case "origin":
                    currentBlock = "backstory";
                    break;
                case "starting_items":
                case "starting_inventory":
                case "items":
                    currentBlock = "items";
                    // Inline items: **Starting Items**: Choose 1: Item A | Item B | Item C
                    if (value) {
                        const chooseMatch = value.match(/choose\s+(\d+)\s*:/i);
                        if (chooseMatch) max_item_picks = parseInt(chooseMatch[1]);
                        const itemPart = value.replace(/choose\s+\d+\s*:/i, "").trim();
                        item_options = itemPart.split("|").map(i => ({
                            id: slugify(i.trim()),
                            name: i.trim(),
                            description: "",
                        })).filter(i => i.name);
                    }
                    break;
                case "starting_location":
                case "starts_at":
                    starting_location = value;
                    break;
                case "allow_custom_name":
                    allow_custom_name = !["false", "no", "fixed"].includes(value.toLowerCase());
                    break;
                case "portrait":
                case "allow_portrait":
                    allow_portrait = !["false", "no"].includes(value.toLowerCase());
                    break;
                case "max_items":
                case "choose_items":
                    max_item_picks = parseInt(value) || 1;
                    break;
            }
            continue;
        }

        // Sub-items under current block
        const subItemMatch = line.match(/^[-*]\s+(.+)$/);
        if (subItemMatch && currentBlock !== "none") {
            const text = subItemMatch[1].trim();

            if (currentBlock === "backstory") {
                // Format: - **The Exile**: backstory description
                const namedMatch = text.match(/^\*\*(.+?)\*\*\s*[:\-]\s*(.*)$/);
                if (namedMatch) {
                    if (currentBackstory) backstory_options.push(currentBackstory);
                    currentBackstory = {
                        id: slugify(namedMatch[1]),
                        label: namedMatch[1].trim(),
                        description: namedMatch[2].trim(),
                    };
                } else if (currentBackstory) {
                    // Continuation line for current backstory
                    currentBackstory.description += " " + text;
                } else {
                    backstory_options.push({
                        id: slugify(text),
                        label: text,
                        description: "",
                    });
                }
                continue;
            }

            if (currentBlock === "traits") {
                trait_options.push(text.replace(/^\[|\]$/g, ""));
                continue;
            }

            if (currentBlock === "items") {
                const itemMatch = text.match(/^\*\*(.+?)\*\*\s*[:\-]\s*(.*)$/) ||
                    text.match(/^(.+?)\s*[:\-]\s*(.*)$/);
                if (itemMatch) {
                    item_options.push({
                        id: slugify(itemMatch[1]),
                        name: itemMatch[1].trim(),
                        description: itemMatch[2].trim(),
                    });
                } else {
                    item_options.push({ id: slugify(text), name: text, description: "" });
                }
                continue;
            }
        }

        // Plain paragraph lines add to description if no other block
        if (line && !line.startsWith("#") && currentBlock === "none" && !description) {
            description = line;
        }
    }

    // Flush any pending backstory
    if (currentBackstory) backstory_options.push(currentBackstory);

    return {
        base_name: base_name || "The Protagonist",
        description,
        kind,
        status,
        fixed_traits,
        backstory_options,
        trait_options,
        item_options,
        max_item_picks,
        allow_custom_name,
        allow_portrait,
        starting_location,
        raw_markdown: markdown,
    };
}

function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}