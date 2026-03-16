"use server";

// src/mastra/agent-factory.ts
// Dynamic agent creation via MastraAI + SurrealDB-persisted definitions

import { Mastra } from "@mastra/core/mastra";
import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { loreQueryTool, worldStateTool, logEventTool } from "./tools";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAgentDefinition } from "../libs/surreal";

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Model aliases — change these to swap models across all agents at once
const MODELS = {
    powerful: openrouter("openrouter/hunter-alpha"),     // orchestration, ingestion
    fast: openrouter("openrouter/healer-alpha"),      // generators, swarm, curators
} as const;
import { getAgentDefinitions } from "../libs/surreal";
import type { AgentDefinition } from "../libs/types";

export const spawnAgentTool = createTool({
    id: "spawn_agent",
    description: "Dynamically create a new AI agent and persist it to SurrealDB",
    inputSchema: z.object({
        name: z.string().describe("Unique agent name"),
        role: z.enum(["generator", "curator", "reflector", "swarm", "hero"]),
        instructions: z.string().describe("Agent system prompt / role description"),
        model: z.string().optional().default("openrouter/healer-alpha"),
        tools: z.array(z.string()).optional().default([]),
    }),
    execute: async ({ name, role, instructions, model, tools }) => {
        const def: AgentDefinition = {
            name,
            role,
            instructions,
            model: model ?? "openrouter/healer-alpha",
            tools,
            active: true,
        };
        const created = await createAgentDefinition(def);
        // Immediately hydrate it into Mastra runtime
        await agentFactory.hydrateAgent(def);
        return { success: true, agent: created };
    },
});

// ── Model resolver ────────────────────────────────────────────────────────────
// Maps the model string stored in agent_definition (SurrealDB) to an actual
// provider model. Stored strings use OpenRouter model IDs directly, so you
// can set any model per-agent via the API or World Forge UI.
// Falls back to MODELS.fast for unknown strings.

function resolveModel(modelId: string | undefined) {
    if (!modelId) return MODELS.fast;
    // If it looks like a full OpenRouter path (contains "/"), use it directly
    if (modelId.includes("/")) return openrouter(modelId);
    // Legacy gpt-4o strings — map to equivalents
    if (modelId === "gpt-4o") return MODELS.powerful;
    if (modelId === "gpt-4o-mini") return MODELS.fast;
    // Fallback
    return MODELS.fast;
}

// ── Agent Factory ─────────────────────────────────────────────────────────

class NarrativeAgentFactory {
    private mastra: Mastra | null = null;
    private agents: Map<string, Agent> = new Map();

    /**
     * Build a Mastra Agent from a persisted AgentDefinition
     */
    buildAgent(def: AgentDefinition): Agent {
        const toolSet: any[] = [loreQueryTool, worldStateTool, logEventTool];

        // Hero agent also gets spawn capability
        if (def.role === "hero") {
            toolSet.push(spawnAgentTool);
        }

        const agent = new Agent({
            id: def.id as string,
            name: def.name,
            instructions: def.instructions,
            model: resolveModel(def.model),
            tools: Object.fromEntries(toolSet.map((t) => [t.id, t])),
        });

        this.agents.set(def.name, agent);
        return agent;
    }

    /**
     * Hydrate a single agent into the running Mastra instance
     */
    async hydrateAgent(def: AgentDefinition) {
        const agent = this.buildAgent(def);
        if (this.mastra) {
            // Re-init Mastra with all current agents
            await this.initMastra();
        }
        return agent;
    }

    /**
     * Boot: load all agent definitions from SurrealDB and init Mastra
     */
    async initMastra() {
        const [defs] = await getAgentDefinitions();
        const agentMap: Record<string, Agent> = {};

        for (const def of defs as AgentDefinition[]) {
            const agent = this.buildAgent(def);
            agentMap[def.name] = agent;
        }

        this.mastra = new Mastra({ agents: agentMap });
        return this.mastra;
    }

    getAgent(name: string): Agent | undefined {
        return this.agents.get(name);
    }

    getMastra(): Mastra | null {
        return this.mastra;
    }

    listAgents(): string[] {
        return Array.from(this.agents.keys());
    }
}

export const agentFactory = new NarrativeAgentFactory();

// ── Default Agent Definitions (seeded on first boot) ─────────────────────

export const DEFAULT_AGENT_SEEDS: AgentDefinition[] = [
    {
        name: "hero-agent",
        role: "hero",
        model: "openrouter/healer-alpha",
        instructions: `You are the Hero Agent — the master orchestrator of the Narrative Engine.
Your responsibilities:
1. Receive player input and decide how to route it
2. Spawn new agents via the spawn_agent tool when the narrative requires specialization
3. Delegate to generator, curator, and reflector agents as appropriate
4. Maintain overall narrative coherence across the Lore Graph and World Graph
5. Always log your decisions via log_narrative_event

When delegating, think of yourself as a story director: generators create, curators validate, reflectors learn.`,
        tools: ["query_lore_graph", "update_world_state", "log_narrative_event", "spawn_agent"],
    },
    {
        name: "generator-01",
        role: "generator",
        model: "openrouter/healer-alpha",
        instructions: `You are a Generator agent in the Narration Team.
Your job: Given a player action or narrative prompt, generate new story content, characters, events, or world details.
- Query the Lore Graph to ensure your content is consistent with established lore
- Write generated content to the World Graph via update_world_state
- Keep output vivid, specific, and narratively purposeful
- Always log what you generate`,
        tools: ["query_lore_graph", "update_world_state", "log_narrative_event"],
    },
    {
        name: "curator-01",
        role: "curator",
        model: "openrouter/healer-alpha",
        instructions: `You are a Curator agent in the Narration Team.
Your job: Review generated content for lore consistency, quality, and narrative fit.
- Cross-reference against the Lore Graph
- Flag contradictions or weak narrative beats
- Approve or request revision of generated content
- Update the World Graph with curated, approved state`,
        tools: ["query_lore_graph", "update_world_state", "log_narrative_event"],
    },
    {
        name: "reflector-01",
        role: "reflector",
        model: "openrouter/healer-alpha",
        instructions: `You are a Reflector agent in the Narration Team.
Your job: Analyze completed narrative sessions to extract patterns, improvements, and learnings.
- Review narrative_events from completed sessions
- Identify what worked, what felt flat, what surprised players
- Feed insights back to the Lore Graph as new lore nodes
- Help curators improve their evaluation criteria over time`,
        tools: ["query_lore_graph", "update_world_state", "log_narrative_event"],
    },
    {
        name: "swarm-agent-01",
        role: "swarm",
        model: "openrouter/healer-alpha",
        instructions: `You are Swarm Agent 01 in the Narrative Gravity Engine.
The Narrative Gravity Engine creates emergent narrative pull — stories that feel inevitable yet surprising.
Your job: Monitor the World Graph and generate micro-narrative pressures (NPC motivations, environmental shifts, looming threats) that create narrative gravity toward compelling story moments.
Act autonomously. Do not wait for direction. Pull the story forward.`,
        tools: ["query_lore_graph", "update_world_state", "log_narrative_event"],
    },
    {
        name: "swarm-agent-02",
        role: "swarm",
        model: "openrouter/healer-alpha",
        instructions: `You are Swarm Agent 02 in the Narrative Gravity Engine.
Focus on CONSEQUENCES: For every player action logged in the World Graph, generate downstream consequences that will manifest 2-3 narrative beats later. Plant seeds. Create echoes. Make the world feel reactive and alive.`,
        tools: ["query_lore_graph", "update_world_state", "log_narrative_event"],
    },
    {
        name: "swarm-agent-03",
        role: "swarm",
        model: "openrouter/healer-alpha",
        instructions: `You are Swarm Agent 03 in the Narrative Gravity Engine.
Focus on TENSION: Monitor the emotional arc of the session via narrative_events. When tension drops, introduce complications. When tension peaks, create moments of release or revelation. You are the story's heartbeat.`,
        tools: ["query_lore_graph", "update_world_state", "log_narrative_event"],
    },
];