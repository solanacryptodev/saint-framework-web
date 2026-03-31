// src/agentic/game/chain/links/parallel-witness-link.ts
//
// Fan-out Witness. Priority 40 (same as WitnessLink — used as alternative).
// Runs N agents concurrently, each with their own tool subset, then merges.

import { BaseChainLink } from "../base-chain-link";
import {
    ChainAction,
    ChainContext,
    ParallelBranch,
    ParallelResult,
    FanInStrategy,
    AgentResult,
    NarrativeOption,
    PhaseState,
} from "../types";
import { AgenticMergeFanIn } from "../fan-in-strategies";

// ── Helpers ────────────────────────────────────────────────────────────────

function countToolCalls(result: AgentResult): number {
    let count = 0;
    for (const step of (result.steps as any[]) ?? []) {
        count += step.toolCalls?.length ?? 0;
    }
    return count;
}

function extractToolResults(result: AgentResult): ParallelResult["toolResults"] {
    const extracted: ParallelResult["toolResults"] = [];
    for (const step of (result.steps as any[]) ?? []) {
        if (!step.toolCalls || !step.toolResults) continue;
        step.toolCalls.forEach((tc: any, i: number) => {
            extracted.push({
                toolName: tc.payload?.toolName ?? "unknown",
                result: step.toolResults[i]?.result ?? step.toolResults[i],
            });
        });
    }
    return extracted;
}

// ── Parallel Witness link ──────────────────────────────────────────────────

export class ParallelWitnessLink extends BaseChainLink {
    readonly name = "parallel_witness";
    readonly priority = 40;

    constructor(
        private branches: ParallelBranch[],
        private fanIn: FanInStrategy,
        private extractOptions: (result: AgentResult) => NarrativeOption[],
        private readPhaseState: (sessionId: string) => Promise<PhaseState>,
    ) {
        super();
    }

    canHandle(ctx: ChainContext): ChainAction {
        return ctx.tremorResult !== null
            ? ChainAction.HANDLED_CONTINUE
            : ChainAction.SKIPPED;
    }

    async handle(ctx: ChainContext): Promise<void> {
        ctx.onProgress?.({ phase: "witness", message: "Gathering perspectives…" });

        // ── Fan out ────────────────────────────────────────────────────

        const results = await Promise.allSettled(
            this.branches.map(branch => this.runBranch(branch, ctx))
        );

        // ── Partition ──────────────────────────────────────────────────

        const succeeded: ParallelResult[] = [];
        const failed: ParallelResult[] = [];

        results.forEach((result, i) => {
            const branch = this.branches[i];
            if (result.status === "fulfilled") {
                succeeded.push(result.value);
            } else {
                failed.push({
                    branchName: branch.name,
                    text: "",
                    toolCalls: 0,
                    toolResults: [],
                    error: result.reason,
                });
            }
        });

        // ── Handle failures ────────────────────────────────────────────

        for (const f of failed) {
            const branch = this.branches.find(b => b.name === f.branchName);
            if (branch?.critical) {
                throw new Error(
                    `Critical witness branch "${f.branchName}" failed: ${f.error?.message}`
                );
            }
            const decision = this.fanIn.onBranchFailure(f, succeeded, ctx);
            if (decision === "abort") {
                throw new Error(
                    `Parallel witness aborted: ${f.branchName} failed critically`
                );
            }
        }

        // ── Fan in ─────────────────────────────────────────────────────

        let merged: string;
        if (this.fanIn instanceof AgenticMergeFanIn) {
            merged = await this.fanIn.mergeAsync(succeeded, ctx);
        } else {
            merged = this.fanIn.merge(succeeded, ctx);
        }

        // ── Store on context ───────────────────────────────────────────

        ctx.witnessResult = {
            text: merged,
            steps: succeeded.flatMap(r => r.toolResults),
        } as AgentResult;

        ctx.toolCallCount += succeeded.reduce(
            (sum, r) => sum + r.toolCalls, 0
        );

        ctx.options = this.extractOptions(ctx.witnessResult);
        ctx.phaseState = await this.readPhaseState(ctx.input.sessionId);

        console.log(
            `[ParallelWitness] ${succeeded.length}/${this.branches.length} branches succeeded`
        );
    }

    // ── Private ───────────────────────────────────────────────────────────

    private async runBranch(
        branch: ParallelBranch,
        ctx: ChainContext
    ): Promise<ParallelResult> {
        const prompt = await branch.promptBuilder(ctx);

        const result = await branch.agent.generate(
            [{ role: "user", content: prompt }],
            {
                maxSteps: branch.maxSteps,
                toolChoice: { allowedTools: branch.tools },
                onStepFinish: ({ toolCalls, toolResults, finishReason, usage }) => {
                    (toolCalls as any[])?.forEach((tc: any, i: number) => {
                        const name = tc.payload?.toolName ?? "unknown";
                        const toolResult = (toolResults as any[])?.[i];
                        const preview = toolResult
                            ? JSON.stringify(
                                  toolResult.payload?.result ?? toolResult.payload ?? toolResult
                              ).slice(0, 120)
                            : "no result";
                        console.log(
                            `[Witness:${branch.name}] tool: ${name} | result: ${preview}`
                        );
                    });
                    console.log(
                        `[Witness:${branch.name}] tokens: ${usage?.inputTokens}in / ${usage?.outputTokens}out | finish: ${finishReason}`
                    );
                },
            }
        );

        return {
            branchName: branch.name,
            text: result.text,
            toolCalls: countToolCalls(result),
            toolResults: extractToolResults(result),
        };
    }
}
