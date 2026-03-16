"use server";

// src/routes/api/lore/relations.ts
// Create and traverse graph relations in the Lore Graph

import { APIEvent } from "@solidjs/start/server";
import { getDB } from "~/libs/surreal";

interface RelationBody {
    from: string;        // e.g. "lore_node:k3j2abc"
    to: string;          // e.g. "lore_node:m8x7def"
    relation_type: string; // e.g. "knows" | "owns" | "located_in"
    weight?: number;
    metadata?: Record<string, unknown>;
}

// POST /api/lore/relations — create a relation (graph edge)
export async function POST(event: APIEvent) {
    try {
        const body = await event.request.json() as RelationBody;
        const { from, to, relation_type, weight = 1.0, metadata = {} } = body;

        if (!from || !to || !relation_type) {
            return new Response(
                JSON.stringify({ error: "from, to, and relation_type are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const db = await getDB();
        // SurrealDB RELATE syntax: RELATE from->relation_type->to
        const [relation] = await db.query(
            `RELATE $from->lore_relation->$to SET relation_type = $relation_type, weight = $weight, metadata = $metadata`,
            { from, to, relation_type, weight, metadata }
        );

        return new Response(JSON.stringify({ success: true, relation }), {
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

// GET /api/lore/relations?from=lore_node:xyz&depth=2
// Traverse the lore graph from a node
export async function GET(event: APIEvent) {
    try {
        const url = new URL(event.request.url);
        const from = url.searchParams.get("from");
        const depth = parseInt(url.searchParams.get("depth") ?? "2", 10);

        if (!from) {
            return new Response(
                JSON.stringify({ error: "from parameter is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const db = await getDB();

        // Graph traversal: depth-1 or depth-2
        let query: string;
        if (depth >= 2) {
            query = `
        SELECT id, kind, name,
          ->lore_relation->(lore_node.{ id, kind, name, ->lore_relation->(lore_node.{ id, kind, name }) AS related_2 }) AS related_1
        FROM $from
      `;
        } else {
            query = `
        SELECT id, kind, name,
          ->lore_relation->(lore_node.{ id, kind, name }) AS related_1
        FROM $from
      `;
        }

        const [result] = await db.query(query, { from });

        return new Response(JSON.stringify({ graph: result }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}