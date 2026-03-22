"use server";

// src/mastra/saint-engine.ts
//
// The SAINT Engine — the game loop superclass.
// Built with the Builder pattern so each game world can configure
// its own agent models, tool sets, genre tone, and phase thresholds
// without changing the loop itself.
//
// Loop order every turn:
//   1. Tremor  — processes player choice, mutates world graph
//   2. Eternal — promotes significant events to lore (conditional)
//   3. Witness — reads both graphs, assembles options
//   4. Prose   — writes the scene description
//   5. Return  — scene + options → player

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Table } from "surrealdb";
import { getDB } from "../../libs/surreal";
import { getGame } from "~/libs/game";
import { PROSE_SYSTEM_PROMPTS } from "./prose";
import type {
    NarrativeOption,
    NarrativeBeat,
    PlayerInfluenceVectors,
    NarrativePhaseState,
    TurnProgress,
} from "../../libs/types";

import {
    TREMOR_SYSTEM_PROMPT,
} from "../game/prompts/reflector-prompt";
import {
    ETERNAL_SYSTEM_PROMPT,
} from "../game/prompts/curator-prompt";
import {
    WITNESS_SYSTEM_PROMPT,
} from "../game/prompts/generator-prompt";

// ── Tool imports ───────────────────────────────────────────────────────────
// Tremor tools
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
} from "./game-tools";

// Eternal tools
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
} from "./game-tools";

// Witness tools
import {
    loreQueryRelevantTool,
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
} from "./game-tools";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// ── Output constraints appended to fast-model agent prompts ───────────────
// These are sticky notes, not essays. The fast model needs an explicit
// ceiling or it will over-explain every tool call.

const TREMOR_OUTPUT_CONSTRAINT = `

═══════════════════════════════════════════════════════════════════════
OUTPUT DISCIPLINE
═══════════════════════════════════════════════════════════════════════
You are running on a fast model. Token budget is tight.

Before each tool call: one sentence stating what you are about to do.
After each tool call: one sentence confirming what changed.
Final summary: 3-5 sentences total. What changed, what was flagged, done.

Do not explain your reasoning at length. Do not restate the input.
Act. Confirm. Move on.
`.trim();

const ETERNAL_OUTPUT_CONSTRAINT = `

═══════════════════════════════════════════════════════════════════════
OUTPUT DISCIPLINE
═══════════════════════════════════════════════════════════════════════
You are running on a fast model. Token budget is tight.

Reasoning: 2-3 sentences maximum before your first tool call.
Decision: one sentence — promote or not, and why in five words.
Per tool call: one sentence confirming the write.
Final log entry: 3-5 sentences. What you wrote, what you skipped, why.

Do not restate the event. Do not explain the SAINT framework.
Read. Decide. Write. Log. Done.
`.trim();

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TurnInput {
    sessionId: string;
    gameId: string;
    playerId: string;
    chosenOptionId: string;
    chosenOptionText: string;
    worldImpact: Record<string, unknown>;
    turnNumber: number;
}

export interface TurnOutput {
    beat: NarrativeBeat;
    sceneDescription: string;
    options: NarrativeOption[];
    phaseState: NarrativePhaseState;
    eternalRan: boolean;
    toolCallCount: number;
    durationMs: number;
}

export interface EngineConfig {
    // Model selection
    powerModel: string;
    fastModel: string;
    proseModel: string;

    // Genre tone passed into Prose Agent
    genreTone: "thriller" | "southern_gothic" | "science_fiction" | "fantasy" | "horror";

    // Eternal threshold — only run when significance >= this value
    eternalSignificanceThreshold: number;

    // Max tool steps per agent
    tremorMaxSteps: number;
    eternalMaxSteps: number;
    witnessMaxSteps: number;

    // Phase thresholds (world-builder controlled)
    phaseThresholds: Record<string, number>;

    // Optional: NPC agents to run in parallel after Tremor
    npcAgentIds?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export class SaintEngineBuilder {
    private config: Partial<EngineConfig> = {};

    powerModel(model: string): this {
        this.config.powerModel = model;
        return this;
    }

    fastModel(model: string): this {
        this.config.fastModel = model;
        return this;
    }

    genre(tone: EngineConfig["genreTone"]): this {
        this.config.genreTone = tone;
        return this;
    }

    eternalThreshold(value: number): this {
        this.config.eternalSignificanceThreshold = value;
        return this;
    }

    maxSteps(tremor: number, eternal: number, witness: number): this {
        this.config.tremorMaxSteps = tremor;
        this.config.eternalMaxSteps = eternal;
        this.config.witnessMaxSteps = witness;
        return this;
    }

    phaseThresholds(thresholds: Record<string, number>): this {
        this.config.phaseThresholds = thresholds;
        return this;
    }

    npcAgents(agentIds: string[]): this {
        this.config.npcAgentIds = agentIds;
        return this;
    }

    build(): SaintEngine {
        // Apply defaults
        //
        // MODEL STRATEGY — read this before changing anything:
        //
        // FAST MODEL (haiku-class):
        //   Tremor, Eternal, NPC agents.
        //   These are database operators. They read a fact, make one decision,
        //   write one record. They should produce 3-5 sentences MAX per tool call.
        //   Low temperature. No chain-of-thought. Just the update.
        //
        // POWER MODEL (sonnet-class):
        //   Witness and Prose Agent only.
        //   The Witness assembles narrative context — it needs to reason across
        //   many nodes and make quality judgments about tension and options.
        //   The Prose Agent writes what the player reads — quality is load-bearing.
        //   These are the only two agents where model quality directly affects
        //   the player experience. Everything else is infrastructure.
        //
        // NEVER use thinking/reasoning models anywhere in this loop.
        // Token cost per turn is already high. Thinking tokens are invisible
        // to the player and produce no narrative value here.
        //
        const resolved: EngineConfig = {
            powerModel: this.config.powerModel ?? "anthropic/claude-haiku-4-5",
            fastModel: this.config.fastModel ?? "anthropic/claude-haiku-4-5",
            proseModel: this.config.proseModel ?? "anthropic/claude-haiku-4-5",
            genreTone: this.config.genreTone ?? "fantasy",
            eternalSignificanceThreshold: this.config.eternalSignificanceThreshold ?? 0.6,
            tremorMaxSteps: this.config.tremorMaxSteps ?? 30,
            eternalMaxSteps: this.config.eternalMaxSteps ?? 20,
            witnessMaxSteps: this.config.witnessMaxSteps ?? 25,
            phaseThresholds: this.config.phaseThresholds ?? {},
            npcAgentIds: this.config.npcAgentIds ?? [],
        };
        return new SaintEngine(resolved);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE SUPERCLASS
// ═══════════════════════════════════════════════════════════════════════════

export class SaintEngine {
    private config: EngineConfig;
    private tremorAgent: Agent;
    private eternalAgent: Agent;
    private witnessAgent: Agent;
    private proseAgent: Agent;

    constructor(config: EngineConfig) {
        this.config = config;
        this.tremorAgent = this.buildTremorAgent();
        this.eternalAgent = this.buildEternalAgent();
        this.witnessAgent = this.buildWitnessAgent();
        this.proseAgent = this.buildProseAgent();
    }

    // ── Factory: static entry point ───────────────────────────────────────

    static builder(): SaintEngineBuilder {
        return new SaintEngineBuilder();
    }

    // ── Main loop ─────────────────────────────────────────────────────────

    async runTurn(input: TurnInput, onProgress?: (update: TurnProgress) => void): Promise<TurnOutput> {
        const start = Date.now();
        let toolCallCount = 0;
        let eternalRan = false;

        // Narrative message arrays for player-facing progress
        const tremorMessages = [
            "The World is shifting in response to your actions...",
            "A ripple moves through the World...",
            "Action is being taken in response to what you just did...",
            "What you just did can never be undone...",
            "A new World is taking shape...",
        ];
        const eternalMessages = [
            "...The Old World will remember this...",
            "...What you did just became canon...",
            "...History is being written...",
            "...The Eternals have chosen to remember this moment...",
            "...demanding an Eternal record be kept...",
        ];
        const witnessMessages = [
            "...so it prepares a response from those who have witnessed it.",
            "...and so, the Witnesses are convening to take action.",
            "...The die has been cast.",
            "...A new reality is taking shape.",
        ];

        // ── STEP 1: TREMOR ────────────────────────────────────────────────
        // Tremor message varies based on world impact weight
        const worldImpact = input.worldImpact as { vectorDeltas?: { moral_stance?: number; approach?: number } };
        console.log('===World Impact===', worldImpact);

        const isDramatic =
            Math.abs(worldImpact?.vectorDeltas?.moral_stance ?? 0) > 0.2 ||
            Math.abs(worldImpact?.vectorDeltas?.approach ?? 0) > 0.2;
        console.log('===Is Dramatic===', isDramatic);

        const tremorMsg = isDramatic
            ? "The world shakes."
            : tremorMessages[input.turnNumber % tremorMessages.length];

        onProgress?.({ phase: "tremor", message: tremorMsg });

        const tremorResult = await this.tremorAgent.generate(
            [
                { role: "user", content: this.buildTremorPrompt(input) }
            ],
            {
                maxSteps: this.config.tremorMaxSteps,
                onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
                    toolCalls?.forEach((tc, i) => {
                        const name = tc.payload?.toolName ?? tc.payload?.toolName ?? 'unknown';
                        const result = toolResults?.[i];
                        const resultPreview = result
                            ? JSON.stringify(result.payload?.result ?? result.payload ?? result).slice(0, 120)
                            : 'no result';
                        console.log(`[===Tremor===] tool: ${name} | result: ${resultPreview}`);
                    });
                    console.log(`[===Tremor===] tokens: ${usage?.inputTokens}in / ${usage?.outputTokens}out | finish: ${finishReason}`);
                }
            }
        );
        toolCallCount += this.countToolCalls(tremorResult);

        // ── STEP 2: ETERNAL (conditional) ─────────────────────────────────
        const eternalSignal = this.extractEternalSignal(tremorResult.text);

        if (eternalSignal && eternalSignal.significance >= this.config.eternalSignificanceThreshold) {
            const eternalMsg = eternalMessages[input.turnNumber % eternalMessages.length];
            onProgress?.({ phase: "eternal", message: eternalMsg });

            const eternalResult = await this.eternalAgent.generate(
                [
                    { role: "user", content: this.buildEternalPrompt(eternalSignal) }
                ],
                {
                    maxSteps: this.config.eternalMaxSteps,
                    onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
                        toolCalls?.forEach((tc, i) => {
                            const name = tc.payload?.toolName ?? tc.payload?.toolName ?? 'unknown';
                            const result = toolResults?.[i];
                            const resultPreview = result
                                ? JSON.stringify(result.payload?.result ?? result.payload ?? result).slice(0, 120)
                                : 'no result';
                            console.log(`[===Eternal===] tool: ${name} | result: ${resultPreview}`);
                        });
                        console.log(`[===Eternal===] tokens: ${usage?.inputTokens}in / ${usage?.outputTokens}out | finish: ${finishReason}`);
                    }
                }
            );
            toolCallCount += this.countToolCalls(eternalResult);
            eternalRan = true;
        }

        // ── STEP 3: NPC AGENTS (parallel, optional) ────────────────────────
        if (this.config.npcAgentIds && this.config.npcAgentIds.length > 0) {
            const npcResults = await this.runNpcAgents(input.sessionId, this.config.npcAgentIds);
            toolCallCount += npcResults.totalToolCalls;
            console.log('===NPC Results===', npcResults);
            console.log('===Tool Call Count===', toolCallCount);
        }

        // ── STEP 4: WITNESS ────────────────────────────────────────────────
        const witnessMsg = witnessMessages[input.turnNumber % witnessMessages.length];
        onProgress?.({ phase: "witness", message: witnessMsg });

        console.log('=== Input ===', input)
        const witnessPrompt = await this.buildWitnessPrompt(input);
        const witnessResult = await this.witnessAgent.generate(
            [
                { role: "user", content: witnessPrompt }
            ],
            {
                maxSteps: this.config.witnessMaxSteps,
                onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
                    toolCalls?.forEach((tc, i) => {
                        const name = tc.payload?.toolName ?? tc.payload?.toolName ?? 'unknown';
                        const result = toolResults?.[i];
                        const resultPreview = result
                            ? JSON.stringify(result.payload?.result ?? result.payload ?? result).slice(0, 120)
                            : 'no result';
                        console.log(`[===Witness===] tool: ${name} | result: ${resultPreview}`);
                    });
                    console.log(`[===Witness===] tokens: ${usage?.inputTokens}in / ${usage?.outputTokens}out | finish: ${finishReason}`);
                }
            }
        );
        toolCallCount += this.countToolCalls(witnessResult);

        // Temporary — add before the extractOptions call
        const firstStepWithTools = witnessResult.steps?.find(
            (s: any) => s.toolResults?.length > 0
        );
        console.log('[Options debug]', JSON.stringify(
            firstStepWithTools?.toolResults?.[0], null, 2
        ).slice(0, 400));

        const options = this.extractOptions(witnessResult);
        console.log('===Options===', options);
        const phaseState = await this.readPhaseState(input.sessionId);
        console.log('===Phase State===', phaseState);

        // ── STEP 5: PROSE AGENT ────────────────────────────────────────────
        onProgress?.({ phase: "prose", message: "Finding the words…" });

        const proseResult = await this.proseAgent.generate([
            {
                role: "user",
                content: this.buildProsePrompt(input, witnessResult.text, options, phaseState),
            }
        ]);
        console.log('===Prose Result===', proseResult.text);
        console.log('===Prose Reasoning===', proseResult.reasoningText);
        // Prose agent has no tools — 0 additional tool calls

        // Clean the prose output to remove any instruction artifacts the LLM echoed back
        const cleanSceneDescription = this.cleanProseResult(proseResult.text);
        console.log('===Clean Scene Description===', cleanSceneDescription);

        // ── STEP 6: PERSIST AND RETURN ────────────────────────────────────
        const beat = await this.persistBeat(input, options, cleanSceneDescription);
        console.log('===Beat===', beat);

        // Signal completion — no message, scene arriving is the signal
        onProgress?.({ phase: "complete", message: "" });

        return {
            beat,
            sceneDescription: cleanSceneDescription,
            options,
            phaseState,
            eternalRan,
            toolCallCount,
            durationMs: Date.now() - start,
        };
    }

    // ── Agent builders ─────────────────────────────────────────────────────

    private buildTremorAgent(): Agent {
        // FAST MODEL — database operator.
        // Reads one choice, writes a small set of world updates.
        // Output should read like a precise field report, not an essay.
        return new Agent({
            id: "tremor",
            name: "tremor",
            model: openrouter(this.config.fastModel, {
                extraBody: {
                    reasoning: {
                        max_tokens: 500,
                        enabled: true
                    }
                }
            }),
            instructions: TREMOR_SYSTEM_PROMPT + TREMOR_OUTPUT_CONSTRAINT,
            tools: {
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
            },
        });
    }

    private buildEternalAgent(): Agent {
        // FAST MODEL — lore archivist.
        // Receives one signal, makes one promotion decision, writes minimal lore.
        // Three sentences of reasoning maximum before acting.
        return new Agent({
            id: "eternal",
            name: "eternal",
            model: openrouter(this.config.fastModel, {
                extraBody: {
                    reasoning: {
                        max_tokens: 500,
                        enabled: true
                    }
                }
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

    private buildWitnessAgent(): Agent {
        // POWER MODEL — narrative reasoner.
        // Reads many nodes, identifies tension, produces quality options.
        // This is the one place where deeper reasoning earns its cost.
        return new Agent({
            id: "witness",
            name: "witness",
            model: openrouter(this.config.powerModel, {
                extraBody: {
                    reasoning: {
                        max_tokens: 1200,
                        enabled: true
                    }
                }
            }),
            instructions: WITNESS_SYSTEM_PROMPT,
            tools: {
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
            },
        });
    }

    private buildProseAgent(): Agent {
        // POWER MODEL — the player-facing voice.
        // 1-2 paragraphs. No tools. Pure generation.
        // This is the other place where model quality is load-bearing.
        return new Agent({
            id: "prose",
            name: "prose",
            model: openrouter(this.config.proseModel, {
                extraBody: {
                    reasoning: {
                        max_tokens: 1200,
                        enabled: true
                    }
                }
            }),
            instructions: this.buildProseSystemPrompt(),
            tools: {},
        });
    }

    // ── Prompt builders ────────────────────────────────────────────────────

    private buildTremorPrompt(input: TurnInput): string {
        return `
SESSION: ${input.sessionId}
TURN: ${input.turnNumber}
PLAYER CHOSE: "${input.chosenOptionText}"
WORLD IMPACT: ${JSON.stringify(input.worldImpact, null, 2)}

Process this choice. Update the world. Signal me if anything significant occurred.
    `.trim();
    }

    private buildEternalPrompt(signal: { eventId: string; reason: string; significance: number }): string {
        return `
The Tremor has flagged an event for your review.

EVENT ID: ${signal.eventId}
SIGNIFICANCE: ${signal.significance}
REASON: ${signal.reason}

Evaluate this event. Decide whether to promote it to permanent lore.
Check for contradictions. If promoting, write the lore. Validate and log.
    `.trim();
    }

    private async buildWitnessPrompt(input: TurnInput): Promise<string> {
        // Get the player's current location for the Witness to query nearby agents
        const db = await getDB();
        const [agentRows] = await db.query<[{ location_id: string }[]]>(
            `SELECT location_id FROM world_agent WHERE id = $id`,
            { id: input.playerId }
        );
        const playerLocation = agentRows?.[0]?.location_id ?? "unknown";

        return `
SESSION: ${input.sessionId}
TURN: ${input.turnNumber}
PLAYER ID: ${input.playerId}
PLAYER LOCATION: ${playerLocation}

The world has been updated. Read both graphs, assemble context,
and produce the player's next 3-5 options. Follow your 7-step process.

IMPORTANT RULES: 
- generate_action_options MUST be called every turn. It is not optional. If you are running low on steps, 
skip additional context queries and call generate_action_options immediately.
    `.trim();
    }

    private buildProsePrompt(
        input: TurnInput,
        witnessContext: string,
        options: NarrativeOption[],
        narrativePhase: NarrativePhaseState
    ): string {
        return `
OUTPUT: 1-2 paragraphs, consisting of 3-5 sentences each. No more than 170 words total with an AVERAGE sentence length of
15-20 words. ONLY use NO MORE THAN 8% adverbs and adjectives combined with an 85/15 split of Germanic/Latinate vocabulary
with a Flesch-Kincaid Grade Level of 8-10. Write in the second person, present tense. 
Name the tension. Spark the imagination. Do not hide what is happening.

CONTEXT FROM THE WITNESS:
${witnessContext.slice(0, 1200)}

OPTIONS GENERATED:
${options.map((o, i) => `${i + 1}. ${o.text}`).join("\n")}

GENRE: ${this.config.genreTone.replace("_", " ")}

NARRATIVE PHASE: This is the ${narrativePhase.current_phase} phase of The Heroes Journey. The response should be grounded in
where we are in that journey. Ordinary World is the player in his or her normal, daily routine. The Call to Adventure is
when the player is presented with a challenge or opportunity that will change their life. Refusal of the Call is when the
player hesitates or refuses the challenge. Meeting the Mentor is when the player meets someone who will guide or help them.
Crossing the Threshold is when the player commits to the journey. Tests, Allies, and Enemies is when the player faces
challenges and meets allies and enemies. The Ordeal is when the player faces their greatest fear or challenge. The Reward is
when the player receives a reward for overcoming the challenge. The Road Back is when the player returns to their normal
life. The Resurrection is when the player faces one last challenge before returning to their normal life. The Return with
the Elixir is when the player returns to their normal life with a reward that will help them and their community. If the 
${narrativePhase.phase_charge} is low, the player is at the beginning of the ${narrativePhase.current_phase} phase and 
should be guided toward the next phase. If the ${narrativePhase.phase_charge} is high, the player is at the end of the 
${narrativePhase.current_phase} and the prose should reflect a rise in tension. The phase stats to pay CLOSE ATTENTION to
are the archetype cohesion: ${narrativePhase.archetype_cohesion} and narrative entropy: ${narrativePhase.narrative_entropy}.
A low archetype cohesion (under 0.5) means the player is not embracing their archetype and should be guided towards a 1.0.
A high narrative entropy (over 0.6) means the story is becoming chaotic and should be guided toward a more coherent narrative (0.4).

Write only the scene description. No options. No narration labels.
    `.trim();
    }

    private buildProseSystemPrompt(): string {
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

Tone: ${toneMap[this.config.genreTone]}
Narrative Phase:


Never use the words: "You feel", "You sense", "You notice".
Show through what is seen, heard, and physically present.
    `.trim();
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private extractEternalSignal(tremorText: string): { eventId: string; reason: string; significance: number } | null {
        // The Tremor writes a structured signal block when it calls notify_eternal.
        // Parse it from the response text.
        // In production this is better handled via a structured output schema on the Tremor agent.
        const match = tremorText.match(/ETERNAL_SIGNAL:\s*({[\s\S]*?})/);
        if (!match) return null;
        try {
            return JSON.parse(match[1]);
        } catch {
            return null;
        }
    }

    private extractOptions(witnessResult: any): NarrativeOption[] {
        // Walk all steps looking for generate_action_options tool result
        for (const step of witnessResult.steps ?? []) {
            for (const result of step.toolResults ?? []) {
                const toolName = result.toolName
                    ?? result.payload?.toolName
                    ?? result.payload?.name;

                if (toolName === 'generate_action_options') {
                    const data = result.result
                        ?? result.payload?.result
                        ?? result.payload;

                    if (Array.isArray(data)) return data;
                    if (Array.isArray(data?.options)) return data.options;
                }
            }
        }
        return [];
    }

    private async readPhaseState(sessionId: string): Promise<NarrativePhaseState> {
        const db = await getDB();
        const [rows] = await db.query<[NarrativePhaseState[]]>(
            `SELECT * FROM narrative_state WHERE session_id = $sid LIMIT 1`,
            { sid: sessionId }
        );
        return rows?.[0] ?? {
            current_phase: "ordinary_world",
            phase_charge: 0,
            narrative_entropy: 0,
            archetype_cohesion: 0.8,
            player_resonance: 0,
            inertia_resistance: 0.5,
        };
    }

    private countToolCalls(result: { steps?: unknown[] }): number {
        // Mastra exposes tool call steps on the result object
        return result.steps?.length ?? 0;
    }

    private cleanProseResult(text: string): string {
        // The LLM sometimes echoes back instruction fragments wrapped in backticks.
        // Strip these artifacts while preserving the actual story content.
        if (!text) return text;

        // Remove all backtick-wrapped content that looks like instructions
        let cleaned = text.replace(/`[^`]*`/g, (match) => {
            const content = match.slice(1, -1);
            // Keep content that reads like actual story (has sentences with verbs)
            const instructionKeywords = [
                'Avoid', 'Use only', 'Show only', 'Focus on', 'Use vivid',
                'Use strong', 'Use short', 'Use active', 'Use direct',
                'Use concrete', 'Use sensory', 'Use staccato', 'Use selective',
                'Use "filter"', 'Use "slow-burn"', 'Use lean prose',
                '(Avoid', '(Use', '(Show', '(Focus', '(Use vivid',
            ];
            const isInstruction = instructionKeywords.some(kw => content.includes(kw));
            if (isInstruction) return '';
            return match; // Keep content that looks like story
        });

        // Split by paragraphs to process them individually
        const paragraphs = cleaned.split(/\n\n+/);

        // Filter out paragraphs that are pure instruction fragments
        const storyParagraphs = paragraphs.filter(p => {
            const trimmed = p.trim();
            if (!trimmed) return false;

            // Skip if it's very short and starts with instruction-like patterns
            if (trimmed.length < 50) {
                const instructionPatterns = [
                    /^Avoid\s/i, /^Use\s/i, /^Show\s/i, /^Focus\s/i,
                    /^\(Avoid/i, /^\(Use/i, /^\(Show/i, /^\(Focus/i,
                ];
                if (instructionPatterns.some(pat => pat.test(trimmed))) return false;
            }

            // Skip if paragraph is mostly parenthetical content (instructions)
            const parenRatio = (trimmed.match(/\([^)]*\)/g) || []).join('').length / trimmed.length;
            if (parenRatio > 0.5) return false;

            return true;
        });

        // Join and clean up any remaining backticks
        return storyParagraphs
            .join('\n\n')
            .replace(/`/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    private async runNpcAgents(
        sessionId: string,
        agentIds: string[]
    ): Promise<{ totalToolCalls: number }> {
        // NPC agents run in parallel after the Tremor.
        // Each reads the updated world state and decides whether to act.
        // Implementation: each NPC agent is a lightweight instance of the
        // Agent class with the NPC's persona baked into its system prompt
        // and a subset of the Agent Game Tools from tools.ts.
        // Left as a stub here — wired up in npc-agent.ts separately.
        return { totalToolCalls: 0 };
    }

    private async persistBeat(
        input: TurnInput,
        options: NarrativeOption[],
        sceneDescription: string
    ): Promise<NarrativeBeat> {
        const db = await getDB();
        const beat: NarrativeBeat = {
            beatId: crypto.randomUUID(),
            sessionId: input.sessionId,
            turnNumber: input.turnNumber,
            sceneDescription,
            activeThreads: [],
            loreContext: [],
            options,
            generatedBy: "witness",
            chosenOptionId: input.chosenOptionId,
            chosenAt: new Date().toISOString(),
            // appliedImpact, curatedBy, swarmReactions, reflectionNotes are optional —
            // populated later by Tremor / Eternal once the choice is processed
        };
        await db.create<NarrativeBeat>(new Table("narrative_beat")).content(beat as unknown as Record<string, unknown>);
        return beat;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// USAGE EXAMPLES
// ═══════════════════════════════════════════════════════════════════════════

/*
  // Ashenveil Chronicles — dark fantasy
  const ashenveilEngine = ACEEngine.builder()
    .powerModel("anthropic/claude-sonnet-4-5")  // Witness + Prose only
    .fastModel("anthropic/claude-haiku-4-5")    // Tremor + Eternal + NPCs
    .genre("fantasy")
    .eternalThreshold(0.6)
    .maxSteps(30, 20, 25)
    .phaseThresholds({
      ordinary_world:     0.4,
      call_to_adventure:  0.6,
      crossing_threshold: 0.8,
      ordeal:             0.9,
    })
    .build();

  // Spy thriller — everything fast, prose is terse anyway
  const thrillerEngine = ACEEngine.builder()
    .powerModel("anthropic/claude-sonnet-4-5")
    .fastModel("anthropic/claude-haiku-4-5")
    .genre("thriller")
    .eternalThreshold(0.7)  // canon is harder to earn in a conspiracy world
    .maxSteps(25, 15, 20)
    .build();

  // Southern gothic vampire — prose gets the power model, everything else fast
  // The writing quality is the product here. Don't cheap out on the voice.
  const vampireEngine = ACEEngine.builder()
    .powerModel("anthropic/claude-sonnet-4-5")
    .fastModel("anthropic/claude-haiku-4-5")
    .genre("southern_gothic")
    .eternalThreshold(0.55)  // memories become legend faster in this world
    .maxSteps(35, 25, 30)
    .phaseThresholds({
      ordinary_world: 0.3,   // slow burn — let it breathe
      descent:        0.7,
    })
    .build();

  // Running a turn:
  const output = await ashenveilEngine.runTurn({
    sessionId: "session:abc123",
    gameId:    "game:xyz789",
    playerId:  "player:456",
    chosenOptionId:   "opt_4",
    chosenOptionText: "Go straight for the basement stairs.",
    worldImpact: {
      method_mark: 0.2,
      story_progress: 0.08,
      keeper_awareness: "suspicious",
    },
    turnNumber: 1,
  });

  // output.sceneDescription — 2-4 sentences for the player
  // output.options          — 3-5 NarrativeOption objects
  // output.eternalRan       — whether lore was updated this turn
  // output.toolCallCount    — total tool calls across all agents (min 12)
  // output.durationMs       — total wall time
*/