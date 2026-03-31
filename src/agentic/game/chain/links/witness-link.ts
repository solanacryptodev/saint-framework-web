// src/agentic/game/chain/links/witness-link.ts
//
// Single-agent Witness. Priority 40.
// Requires a tremorResult to proceed. Reads both graphs,
// assembles narrative context, produces player options.

import { BaseChainLink } from "../base-chain-link";
import {
    ChainAction,
    ChainContext,
    AgenticAgent,
    AgentResult,
    NarrativeOption,
    PhaseState,
} from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

const witnessMessages = [
    "...so it prepares a response from those who have witnessed it.",
    "...and so, the Witnesses are convening to take action.",
    "...The die has been cast.",
    "...A new reality is taking shape.",
];

function countToolCalls(result: AgentResult): number {
    return result.toolCalls?.length ?? 0;
}

// ── Witness link ───────────────────────────────────────────────────────────

export class WitnessLink extends BaseChainLink {
    readonly name = "witness";
    readonly priority = 40;

    constructor(
        private agent: AgenticAgent,
        private config: { maxSteps: number },
        private buildPrompt: (input: ChainContext["input"]) => Promise<string>,
        private extractOptions: (result: AgentResult) => NarrativeOption[],
        private readPhaseState: (sessionId: string) => Promise<PhaseState>,
    ) {
        super();
    }

    canHandle(ctx: ChainContext): ChainAction {
        // Witness needs at least a tremor result
        return ctx.tremorResult !== null
            ? ChainAction.HANDLED_CONTINUE
            : ChainAction.SKIPPED;
    }

    async handle(ctx: ChainContext): Promise<void> {
        const witnessMsg =
            witnessMessages[ctx.input.turnNumber % witnessMessages.length];
        ctx.onProgress?.({ phase: "witness", message: witnessMsg });

        console.log("=== Input ===", ctx.input);
        const prompt = await this.buildPrompt(ctx.input);

        const result = await this.agent.generate(
            [{ role: "user", content: prompt }],
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
                        console.log(`[===Witness===] tool: ${name} | result: ${preview}`);
                    });
                    console.log(
                        `[===Witness===] tokens: ${usage?.inputTokens}in / ${usage?.outputTokens}out | finish: ${finishReason}`
                    );
                },
            }
        );

        ctx.witnessResult = result;
        ctx.toolCallCount += countToolCalls(result);

        // Debug options extraction
        const firstStepWithTools = (result.steps as any[])?.find(
            (s: any) => s.toolResults?.length > 0
        );
        console.log("[Options debug]", JSON.stringify(
            firstStepWithTools?.toolResults?.[0], null, 2
        ).slice(0, 400));

        ctx.options = this.extractOptions(result);
        console.log("===Options===", ctx.options);
        ctx.phaseState = await this.readPhaseState(ctx.input.sessionId);
        console.log("===Phase State===", ctx.phaseState);
    }
}
