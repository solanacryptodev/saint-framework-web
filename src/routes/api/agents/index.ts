// src/routes/api/agents/index.ts
// GET  /api/agents       — list all active agents
// POST /api/agents       — spawn a new dynamic agent

import { APIEvent } from "@solidjs/start/server";
import { listActiveAgents, spawnDynamicAgent } from "~/agentic/orchestrator";
import { type AgentDefinition } from "~/libs/types";

export async function GET(_event: APIEvent) {
    const agents = await listActiveAgents();
    return new Response(JSON.stringify({ agents }), {
        headers: { "Content-Type": "application/json" },
    });
}

export async function POST(event: APIEvent) {
    try {
        const body = await event.request.json();

        // Validate required fields
        const { name, role, instructions, model, tools } = body as AgentDefinition;
        if (!name || !role || !instructions) {
            return new Response(
                JSON.stringify({ error: "name, role, and instructions are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const validRoles = ["generator", "curator", "reflector", "swarm", "hero"];
        if (!validRoles.includes(role)) {
            return new Response(
                JSON.stringify({ error: `role must be one of: ${validRoles.join(", ")}` }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const created = await spawnDynamicAgent({
            name,
            role,
            instructions,
            model: model ?? "gpt-4o-mini",
            tools: tools ?? [],
            active: true,
        });

        return new Response(JSON.stringify({ success: true, agent: created }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[POST /api/agents]", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}