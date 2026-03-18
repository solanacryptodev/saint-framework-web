"use server";

// src/lib/game.ts
//
// The Game record is what World Forge produces and what /play/[gameId] reads.
// It ties together the creator's account, the initialized graphs, and the
// world metadata (name, tagline, entity images, visibility).
//
// One player can own many games. Each game has:
//   • A game record in SurrealDB (name, tagline, creator, status)
//   • A fully initialized Lore Graph (lore_node + lore_relation + lore_event)
//   • A fully initialized World Graph (world_agent, world_location, world_item, world_concept, world_event, world_thread)
//   • Per-entity asset bindings (image URLs attached to lore_nodes)
//   • A world_init record confirming both graphs are ready
//
// Status flow:
//   draft → initializing → review → ready → archived
//
// /create/world-forge  creates the record and runs initialization (draft → ready)
// /play/[gameId]       reads a ready record and starts a session

import { getDB } from "./surreal";
import { Table, surql } from "surrealdb";
import { CostTier, GameRecord } from "./types";

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function createGame(
    creatorId: string,
    params: {
        name: string;
        tagline?: string;
        description?: string;
        genre?: string;
        tags?: string[];
        cost_tier?: CostTier;
        cost?: number;
        sourceFile?: string;
        coverImage?: string | null;
        createdBy?: string;
    }
): Promise<GameRecord> {
    const db = await getDB();
    // Normalize — strip table prefix if present ("player:01j..." → "01j...")
    const normalizedCreatorId = creatorId.includes(":")
        ? creatorId.slice(creatorId.indexOf(":") + 1)
        : creatorId;
    const now = new Date().toISOString();
    const [record] = await db.create<GameRecord>(new Table("game")).content({
        creator_id: normalizedCreatorId,
        created_by: params.createdBy,
        name: params.name,
        tagline: params.tagline ?? "",
        description: params.description ?? "",
        genre: params.genre ?? "",
        tags: params.tags ?? [],
        cost_tier: params.cost_tier ?? "free",
        cost: params.cost ?? 0,
        status: "draft",
        source_file: params.sourceFile ?? "",
        cover_image: params.coverImage ?? null,
        lore_nodes: 0,
        lore_edges: 0,
        world_agents: 0,
        world_locations: 0,
        world_items: 0,
        world_concepts: 0,
        world_events: 0,
        world_threads: 0,
        visibility: "private",
        created_at: now,
        updated_at: now,
    });
    return record;
}

export async function updateGameStatus(
    gameId: string,
    status: GameRecord["status"],
    stats?: Partial<Pick<GameRecord,
        "lore_nodes" |
        "lore_edges" |
        "world_agents" |
        "world_locations" |
        "world_items" |
        "world_concepts" |
        "world_events" |
        "world_threads"
    >>
) {
    const db = await getDB();
    const recordId = gameId.startsWith("game:") ? gameId : `game:${gameId}`;
    const patch: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
        ...(stats ?? {}),
    };
    if (status === "ready") patch.launched_at = new Date().toISOString();
    return db.query(
        `UPDATE type::thing($id) SET ${Object.keys(patch).map(k => `${k} = $${k}`).join(", ")}`,
        { id: recordId, ...patch }
    );
}

export async function updateGameInfo(
    gameId: string,
    info: {
        description?: string;
        genre?: string;
        tags?: string[];
        cost_tier?: CostTier;
        cost?: number;
    }
) {
    const db = await getDB();
    const recordId = gameId.startsWith("game:") ? gameId : `game:${gameId}`;
    const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };
    if (info.description !== undefined) patch.description = info.description;
    if (info.genre !== undefined) patch.genre = info.genre;
    if (info.tags !== undefined) patch.tags = info.tags;
    if (info.cost_tier !== undefined) patch.cost_tier = info.cost_tier;
    if (info.cost !== undefined) patch.cost = info.cost;
    return db.query(
        `UPDATE type::thing($id) SET ${Object.keys(patch).map(k => `${k} = $${k}`).join(", ")}`,
        { id: recordId, ...patch }
    );
}

export async function getGame(gameId: string): Promise<GameRecord | null> {
    const db = await getDB();

    // Ensure we have the full record ID format "game:xxx"
    const recordId = gameId.startsWith("game:") ? gameId : `game:${gameId}`;

    const [rows] = await db.query<[GameRecord[]]>(
        `SELECT * FROM type::thing($id)`,
        { id: recordId }
    );
    return rows?.[0] ?? null;
}

export async function getPlayerGames(creatorId: string): Promise<GameRecord[]> {
    const db = await getDB();
    const [rows] = await db.query<[GameRecord[]]>(
        `SELECT * FROM game WHERE creator_id = $id ORDER BY created_at DESC`,
        { id: creatorId }
    );
    return rows ?? [];
}

export async function getPublicGames(): Promise<GameRecord[]> {
    const db = await getDB();
    const [rows] = await db.query<[GameRecord[]]>(
        `SELECT * FROM game WHERE visibility = 'public' AND status = 'ready' ORDER BY created_at DESC LIMIT 12`
    );
    console.log('[getPublicGames] rows:', rows);
    return rows ?? [];
}

export async function upsertEntityAsset(
    gameId: string,
    loreNodeId: string,
    imageUrl?: string,
    notes?: string
) {
    const db = await getDB();
    return db.query(`
    UPSERT entity_asset
    SET game_id = $gameId, lore_node_id = $nodeId,
        image_url = $imageUrl, notes = $notes,
        updated_at = time::now()
    WHERE game_id = $gameId AND lore_node_id = $nodeId
  `, { gameId, nodeId: loreNodeId, imageUrl: imageUrl ?? null, notes: notes ?? "" });
}

export async function getEntityAssets(gameId: string) {
    const db = await getDB();
    const [rows] = await db.query<[any[]]>(
        `SELECT * FROM entity_asset WHERE game_id = $gameId`,
        { gameId }
    );
    return rows ?? [];
}

export async function getPlayerDisplayName(playerId: string): Promise<string> {
    const db = await getDB();
    const normalizedId = playerId.includes(":")
        ? playerId.slice(playerId.indexOf(":") + 1)
        : playerId;

    const [rows] = await db.query<[{ display_name: string }[]]>(
        `SELECT display_name FROM player WHERE id = type::thing('player', $id)`,
        { id: normalizedId }
    );
    return rows?.[0]?.display_name ?? "Unknown Creator";
}

export async function updateGameCreatedBy(gameId: string, createdBy: string) {
    const db = await getDB();
    const recordId = gameId.startsWith("game:") ? gameId : `game:${gameId}`;
    return db.query(
        `UPDATE type::thing($id) SET created_by = $createdBy, visibility = 'public', status = 'ready', updated_at = time::now()`,
        { id: recordId, createdBy }
    );
}
