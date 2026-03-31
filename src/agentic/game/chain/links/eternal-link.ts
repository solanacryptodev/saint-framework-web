// src/agentic/game/chain/links/eternal-link.ts
//
// Conditional Eternal. Priority 30.
// Fires when the tremor signal meets the significance threshold.

import { BaseChainLink } from "../base-chain-link";
import {
    ChainAction,
    ChainContext,
    AgenticAgent,
    AgentResult,
} from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

const eternalMessages = [
    "...The Old World will remember this...",
    "...What you did just became canon...",
    "...History is being written...",
    "...The Eternals have chosen to remember this moment...",
    "...demanding an Eternal record be kept...",
];

function countToolCalls(result: AgentResult): number {
    return result.toolCalls?.length ?? 0;
}

// ── Eternal link ───────────────────────────────────────────────────────────

export class EternalLink extends BaseChainLink {
    readonly name = "eternal";
    readonly priority = 30;

    constructor(
        private agent: AgenticAgent,
        private config: {
            maxSteps: number;
            significanceThreshold: number;
        },
        private buildPrompt: (signal: NonNullable<ChainContext["eternalSignal"]>) => string,
    ) {
        super();
    }

    shouldConsider(ctx: ChainContext): boolean {
        return ctx.eternalSignal !== null;
    }

    canHandle(ctx: ChainContext): ChainAction {
        if (!ctx.eternalSignal) return ChainAction.SKIPPED;
        if (ctx.eternalSignal.significance < this.config.significanceThreshold) {
            return ChainAction.SKIPPED;
        }
        return ChainAction.HANDLED_CONTINUE;
    }

    onSkip(_ctx: ChainContext): void {
        console.log("[Eternal] significance too low or no signal — skipping");
    }

    async handle(ctx: ChainContext): Promise<void> {
        const eternalMsg =
            eternalMessages[ctx.input.turnNumber % eternalMessages.length];
        ctx.onProgress?.({ phase: "eternal", message: eternalMsg });

        const result = await this.agent.generate(
            [{ role: "user", content: this.buildPrompt(ctx.eternalSignal!) }],
            {
                maxSteps: this.config.maxSteps,
                onStepFinish: ({ toolCalls, toolResults, finishReason, usage }) => {
                    (toolCalls as any[])?.forEach((tc: any, i: number) => {
                        const name = tc.payload?.toolName ?? "unknown";
                        const toolResult = (toolResults as any[])?.[i];
                        const preview = toolResult
                            ? JSON.stringify(
                                  toolResult.payload?.result ?? toolResult.payload ?? toolResult
                              ).slice(0, 120)
                            : "no result";
                        console.log(`[===Eternal===] tool: ${name} | result: ${preview}`);
                    });
                    console.log(
                        `[===Eternal===] tokens: ${usage?.inputTokens}in / ${usage?.outputTokens}out | finish: ${finishReason}`
                    );
                },
            }
        );

        ctx.eternalResult = result;
        ctx.toolCallCount += countToolCalls(result);
        ctx.metadata.eternalRan = true;
    }
}
