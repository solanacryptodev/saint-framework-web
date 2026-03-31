"use server";

// src/agentic/game/agents/witness-agent.ts
//
// Witness agent factory.
// POWER MODEL — narrative reasoner.
// Reads many nodes, identifies tension, produces quality options.
// This is the one place where deeper reasoning earns its cost.

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
    WITNESS_SYSTEM_PROMPT,
} from "../prompts/generator-prompt";
import {
    loreQueryRelevantTool,
    loreGetConnectionsTool,
    loreGetByKindTool,
    worldQueryNearbyAgentsTool,
    worldQueryActiveEventsTool,
    worldGetAgentGoalsTool,
    worldQueryConceptsByAdoptionTool,
    worldGetFactionTensionsTool,
    checkStoryPhaseTool,
    generateActionOptionsTool,
    generateDialogueOptionsTool,
    calculateOptionConsequencesTool,
} from "../game-tools";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

export function buildWitnessAgent(powerModel: string, allowedTools?: string[]): Agent {
    const allTools = {
        lore_query_relevant: loreQueryRelevantTool,
        lore_get_connections: loreGetConnectionsTool,
        lore_get_by_kind: loreGetByKindTool,
        world_query_nearby_agents: worldQueryNearbyAgentsTool,
        world_query_active_events: worldQueryActiveEventsTool,
        world_get_agent_goals: worldGetAgentGoalsTool,
        world_query_concepts_by_adoption: worldQueryConceptsByAdoptionTool,
        world_get_faction_tensions: worldGetFactionTensionsTool,
        check_story_phase: checkStoryPhaseTool,
        generate_action_options: generateActionOptionsTool,
        generate_dialogue_options: generateDialogueOptionsTool,
        calculate_option_consequences: calculateOptionConsequencesTool,
    };

    const tools = allowedTools
        ? Object.fromEntries(Object.entries(allTools).filter(([k]) => allowedTools.includes(k)))
        : allTools;

    return new Agent({
        id: "witness",
        name: "witness",
        model: openrouter(powerModel, {
            extraBody: {
                reasoning: {
                    max_tokens: 1200,
                    enabled: true,
                },
            },
        }),
        instructions: WITNESS_SYSTEM_PROMPT,
        tools,
    });
}
