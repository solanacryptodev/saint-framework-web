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
//   • A fully initialized World Graph (world_actor, world_location, etc.)
//   • Per-entity asset bindings (image URLs attached to lore_nodes)
//   • A world_init record confirming both graphs are ready
//
// Status flow:
//   draft → initializing → review → ready → archived
//
// /create/world-forge  creates the record and runs initialization (draft → ready)
// /play/[gameId]       reads a ready record and starts a session

import { getDB } from "./surreal";
import { Table } from "surrealdb";
import { CostTier, GameRecord } from "./types";

// ── Schema ──────────────────────────────────────────────────────────────────

export async function applyGameSchema() {
    const db = await getDB();

    await db.query(`
    DEFINE TABLE game SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS creator_id    ON game TYPE string;
    DEFINE FIELD IF NOT EXISTS name          ON game TYPE string;
    DEFINE FIELD IF NOT EXISTS tagline       ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS description   ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS cost_tier     ON game TYPE string DEFAULT "free";
    DEFINE FIELD IF NOT EXISTS genre         ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS cover_image   ON game TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS status        ON game TYPE string DEFAULT "draft";
    DEFINE FIELD IF NOT EXISTS source_file   ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS lore_nodes    ON game TYPE int    DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS lore_edges    ON game TYPE int    DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS world_actors  ON game TYPE int    DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS world_threads ON game TYPE int    DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS cost          ON game TYPE int    DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS visibility    ON game TYPE string DEFAULT "private";
    DEFINE FIELD IF NOT EXISTS created_at    ON game TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updated_at    ON game TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS launched_at   ON game TYPE option<datetime>;
    DEFINE INDEX IF NOT EXISTS game_creator  ON game COLUMNS creator_id;

    -- Per-entity image/asset bindings (attached during World Forge review)
    DEFINE TABLE IF NOT EXISTS entity_asset SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS game_id       ON entity_asset TYPE string;
    DEFINE FIELD IF NOT EXISTS lore_node_id  ON entity_asset TYPE string;
    DEFINE FIELD IF NOT EXISTS image_url     ON entity_asset TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS audio_url     ON entity_asset TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS notes         ON entity_asset TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS updated_at    ON entity_asset TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS asset_game    ON entity_asset COLUMNS game_id;
    DEFINE INDEX IF NOT EXISTS asset_node    ON entity_asset COLUMNS lore_node_id;
  `);
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function createGame(
    creatorId: string,
    params: {
        name: string;
        tagline?: string;
        description?: string;
        genre?: string;
        cost_tier?: CostTier;
        cost?: number;
        sourceFile?: string;
    }
): Promise<GameRecord> {
    const db = await getDB();
    // Normalize — strip table prefix if present ("player:01j..." → "01j...")
    const normalizedCreatorId = creatorId.includes(":")
        ? creatorId.slice(creatorId.indexOf(":") + 1)
        : creatorId;
    const [record] = await db.create<GameRecord>(new Table("game")).content({
        creator_id: normalizedCreatorId,
        name: params.name,
        tagline: params.tagline ?? "",
        description: params.description ?? "",
        genre: params.genre ?? "",
        cost_tier: params.cost_tier ?? "free",
        cost: params.cost ?? 0,
        status: "draft",
        source_file: params.sourceFile ?? "",
        lore_nodes: 0,
        lore_edges: 0,
        world_actors: 0,
        world_threads: 0,
        visibility: "private",
    });
    return record;
}

export async function updateGameStatus(
    gameId: string,
    status: GameRecord["status"],
    stats?: Partial<Pick<GameRecord, "lore_nodes" | "lore_edges" | "world_actors" | "world_threads">>
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