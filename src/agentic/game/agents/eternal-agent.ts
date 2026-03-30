"use server";

// src/agentic/game/agents/eternal-agent.ts
//
// Eternal agent factory.
// FAST MODEL — lore archivist.
// Receives one signal, makes one promotion decision, writes minimal lore.
// Three sentences of reasoning maximum before acting.

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
    ETERNAL_SYSTEM_PROMPT,
    ETERNAL_OUTPUT_CONSTRAINT,
} from "../prompts/curator-prompt";
import {
    worldGetEventTool,
    worldGetAgentTool,
    worldGetConceptTool,
    loreQueryContradictionsTool,
    loreGetConnectionsTool,
    loreCreateNodeTool,
    loreUpdateNodeTool,
    loreSetCanonTool,
    loreCreateRelationTool,
    loreMergeNodesTool,
    loreArchiveNodeTool,
    loreResolveContradictionTool,
    validateCanonConsistencyTool,
} from "../game-tools";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

export function buildEternalAgent(fastModel: string): Agent {
    return new Agent({
        id: "eternal",
        name: "eternal",
        model: openrouter(fastModel, {
            extraBody: {
                reasoning: {
                    max_tokens: 500,
                    enabled: true,
                },
            },
        }),
        instructions: ETERNAL_SYSTEM_PROMPT + ETERNAL_OUTPUT_CONSTRAINT,
        tools: {
            world_get_event: worldGetEventTool,
            world_get_agent: worldGetAgentTool,
            world_get_concept: worldGetConceptTool,
            lore_query_contradictions: loreQueryContradictionsTool,
            lore_get_connections: loreGetConnectionsTool,
            lore_create_node: loreCreateNodeTool,
            lore_update_node: loreUpdateNodeTool,
            lore_set_canon: loreSetCanonTool,
            lore_create_relation: loreCreateRelationTool,
            lore_merge_nodes: loreMergeNodesTool,
            lore_archive_node: loreArchiveNodeTool,
            lore_resolve_contradiction: loreResolveContradictionTool,
            validate_canon_consistency: validateCanonConsistencyTool,
        },
    });
}
