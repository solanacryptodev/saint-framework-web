// src/agentic/game/chain/links/tremor-link.ts
//
// Single-agent Tremor. Priority 10 — runs after Herald.
// Use this when parallel fan-out is not configured.

import { BaseChainLink } from "../base-chain-link";
import {
    ChainAction,
    ChainContext,
    AgenticAgent,
    AgentResult,
} from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

const tremorMessages = [
    "The World is shifting in response to your actions...",
    "A ripple moves through the World...",
    "Action is being taken in response to what you just did...",
    "What you just did can never be undone...",
    "A new World is taking shape...",
];

function countToolCalls(result: AgentResult): number {
    return result.toolCalls?.length ?? 0;
}

function extractEternalSignal(text: string): {
    text: string;
    significance: number;
    source?: string;
} | null {
    const match = text.match(/ETERNAL_SIGNAL:\s*({[\s\S]*?})/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(match[1]) as {
            eventId?: string;
            reason?: string;
            significance: number;
        };
        return {
            text: parsed.reason ?? parsed.eventId ?? "",
            significance: parsed.significance ?? 0,
            source: parsed.eventId,
        };
    } catch {
        return null;
    }
}

// ── Tremor link ────────────────────────────────────────────────────────────

export class TremorLink extends BaseChainLink {
    readonly name = "tremor";
    readonly priority = 10;

    constructor(
        private agent: AgenticAgent,
        private config: { maxSteps: number },
        private buildPrompt: (input: ChainContext["input"]) => string,
    ) {
        super();
    }

    canHandle(_ctx: ChainContext): ChainAction {
        return ChainAction.HANDLED_CONTINUE;
    }

    async handle(ctx: ChainContext): Promise<void> {
        const worldImpact = ctx.input.worldImpact as {
            vectorDeltas?: { moral_stance?: number; approach?: number };
        };

        const isDramatic =
            Math.abs(worldImpact?.vectorDeltas?.moral_stance ?? 0) > 0.2 ||
            Math.abs(worldImpact?.vectorDeltas?.approach ?? 0) > 0.2;

        const tremorMsg = isDramatic
            ? "The world shakes."
            : tremorMessages[ctx.input.turnNumber % tremorMessages.length];

        ctx.onProgress?.({ phase: "tremor", message: tremorMsg });

        console.log("===World Impact===", ctx.input.worldImpact);
        console.log("===Is Dramatic===", isDramatic);

        const result = await this.agent.generate(
            [{ role: "user", content: this.buildPrompt(ctx.input) }],
            {
                maxSteps: this.config.maxSteps,
                onStepFinish: ({ toolCalls, toolResults, finishReason, usage }) => {
                    toolCalls?.forEach((tc: any, i: number) => {
                        const name = tc.payload?.toolName ?? "unknown";
                        const toolResult = (toolResults as any[])?.[i];
                        const preview = toolResult
                            ? JSON.stringify(
                                  toolResult.payload?.result ?? toolResult.payload ?? toolResult
                              ).slice(0, 120)
                            : "no result";
                        console.log(`[===Tremor===] tool: ${name} | result: ${preview}`);
                    });
                    console.log(
                        `[===Tremor===] tokens: ${usage?.inputTokens}in / ${usage?.outputTokens}out | finish: ${finishReason}`
                    );
                },
            }
        );

        ctx.tremorResult = result;
        ctx.toolCallCount += countToolCalls(result);
        ctx.eternalSignal = extractEternalSignal(result.text);
        ctx.metadata.isDramatic = isDramatic;
    }
}
