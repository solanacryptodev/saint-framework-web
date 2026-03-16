"use server";
// src/routes/api/lore/index.ts
// Lore Graph CRUD operations

import { APIEvent } from "@solidjs/start/server";
import { Table } from "surrealdb";
import { getDB } from "~/libs/surreal";
import type { LoreNode } from "~/libs/types";

// POST /api/lore/nodes — create a lore node
export async function POST(event: APIEvent) {
    try {
        const body = await event.request.json() as Partial<LoreNode>;
        const { kind, name, description, properties } = body;

        if (!kind || !name) {
            return new Response(
                JSON.stringify({ error: "kind and name are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const db = await getDB();
        const [node] = await db.create<LoreNode>(new Table("lore_node")).content({
            kind,
            name,
            description: description ?? "",
            properties: properties ?? {},
        });

        return new Response(JSON.stringify({ success: true, node }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}

// GET /api/lore/nodes?kind=character&limit=50&offset=0 — list lore nodes
export async function GET(event: APIEvent) {
    try {
        const url = new URL(event.request.url);
        const kind = url.searchParams.get("kind");
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
        const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0);
        const db = await getDB();

        let nodes: LoreNode[];

        if (kind) {
            const [result] = await db.query<[LoreNode[]]>(
                `SELECT * FROM lore_node WHERE kind = $kind LIMIT $limit START $offset`,
                { kind, limit, offset }
            );
            nodes = result ?? [];
        } else {
            // db.select() has no native pagination — use query for consistency
            const [result] = await db.query<[LoreNode[]]>(
                `SELECT * FROM lore_node LIMIT $limit START $offset`,
                { limit, offset }
            );
            nodes = result ?? [];
        }

        return new Response(JSON.stringify({ nodes, limit, offset }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}