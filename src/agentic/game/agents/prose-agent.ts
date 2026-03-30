"use server";

// src/agentic/game/agents/prose-agent.ts
//
// Prose agent factory.
// POWER MODEL — the player-facing voice.
// 1-2 paragraphs. No tools. Pure generation.
// This is where model quality is load-bearing.

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { PROSE_SYSTEM_PROMPTS } from "../prose";
import type { EngineConfig } from "../../../libs/types";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

function buildProseSystemPrompt(genreTone: EngineConfig["genreTone"]): string {
    const toneMap: Record<EngineConfig["genreTone"], string> = {
        thriller: PROSE_SYSTEM_PROMPTS.thriller,
        southern_gothic: PROSE_SYSTEM_PROMPTS.southern_gothic,
        science_fiction: PROSE_SYSTEM_PROMPTS.science_fiction,
        fantasy: PROSE_SYSTEM_PROMPTS.fantasy,
        horror: PROSE_SYSTEM_PROMPTS.horror,
    };

    return `
You are the Prose Agent. You write the scene description using very RICH and BEAUTIFUL prose that the player reads.
You receive context from the Witness — world state, active events, NPC goals —
and you transform it into immersive second-person present-tense prose.

Your output is 1-2 paragraphs, consisting of 3-5 sentences each. That is all. No more.
You name the tension. You do not resolve it.
You describe the stakes and raise or lower them based on the tone and narrative phase metadata.
You describe what the player perceives — not what they know.

Tone: ${toneMap[genreTone]}
Narrative Phase:


Never use the words: "You feel", "You sense", "You notice".
Show through what is seen, heard, and physically present.
    `.trim();
}

export function buildProseAgent(
    proseModel: string,
    genreTone: EngineConfig["genreTone"]
): Agent {
    return new Agent({
        id: "prose",
        name: "prose",
        model: openrouter(proseModel, {
            extraBody: {
                reasoning: {
                    max_tokens: 1200,
                    enabled: true,
                },
            },
        }),
        instructions: buildProseSystemPrompt(genreTone),
        tools: {},
    });
}
