"use server";

// src/agentic/game/agents/tremor-agent.ts
//
// Tremor agent factory.
// FAST MODEL — database operator.
// Reads one choice, writes a small set of world updates.
// Output should read like a precise field report, not an essay.

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
    TREMOR_SYSTEM_PROMPT,
    TREMOR_OUTPUT_CONSTRAINT,
} from "../prompts/reflector-prompt";
import {
    worldUpdateAgentTool,
    worldUpdateLocationTool,
    worldUpdateFactionTool,
    worldUpdateConceptTool,
    worldCreateEventTool,
    worldResolveEventTool,
    worldCreateConceptTool,
    worldUpdateRelationshipTool,
    propagateMoodTool,
    propagateConceptTool,
    propagatePlayerMarkTool,
    checkSignificanceTool,
    checkContradictionTool,
    notifyEternalTool,
    notifyEternalContradictionTool,
} from "../game-tools";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

export function buildTremorAgent(fastModel: string, allowedTools?: string[]): Agent {
    const allTools = {
        world_update_agent: worldUpdateAgentTool,
        world_update_location: worldUpdateLocationTool,
        world_update_faction: worldUpdateFactionTool,
        world_update_concept: worldUpdateConceptTool,
        world_create_event: worldCreateEventTool,
        world_resolve_event: worldResolveEventTool,
        world_create_concept: worldCreateConceptTool,
        world_update_relationship: worldUpdateRelationshipTool,
        propagate_mood: propagateMoodTool,
        propagate_concept: propagateConceptTool,
        propagate_player_mark: propagatePlayerMarkTool,
        check_significance: checkSignificanceTool,
        check_contradiction: checkContradictionTool,
        notify_eternal: notifyEternalTool,
        notify_eternal_contradiction: notifyEternalContradictionTool,
    };

    const tools = allowedTools
        ? Object.fromEntries(Object.entries(allTools).filter(([k]) => allowedTools.includes(k)))
        : allTools;

    return new Agent({
        id: "tremor",
        name: "tremor",
        model: openrouter(fastModel, {
            extraBody: {
                reasoning: {
                    max_tokens: 500,
                    enabled: true,
                },
            },
        }),
        instructions: TREMOR_SYSTEM_PROMPT + TREMOR_OUTPUT_CONSTRAINT,
        tools,
    });
}
