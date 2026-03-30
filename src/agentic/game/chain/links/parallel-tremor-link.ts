// src/agentic/game/chain/links/parallel-tremor-link.ts
//
// Fan-out Tremor. Priority 10 (same as TremorLink — used as alternative).
// Runs N agents concurrently, each with its own tool subset, then merges.

import { BaseChainLink } from "../base-chain-link";
import {
    ChainAction,
    ChainContext,
    ParallelBranch,
    ParallelResult,
    FanInStrategy,
    AgentResult,
} from "../types";
import { AgenticMergeFanIn } from "../fan-in-strategies";

// ── Helpers ────────────────────────────────────────────────────────────────

const tremorMessages = [
    "The World is shifting in response to your actions...",
    "A ripple moves through the World...",
    "Action is being taken in response to what you just did...",
    "What you just did can never be undone...",
    "A new World is taking shape...",
];

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

// ── Parallel Tremor link ───────────────────────────────────────────────────

export class ParallelTremorLink extends BaseChainLink {
    readonly name = "parallel_tremor";
    readonly priority = 10;

    constructor(
        private branches: ParallelBranch[],
        private fanIn: FanInStrategy,
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

        // ── Fan out: run all branches concurrently ─────────────────────

        const results = await Promise.allSettled(
            this.branches.map(branch => this.runBranch(branch, ctx))
        );

        // ── Partition into successes and failures ──────────────────────

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

        // ── Handle failures per strategy ───────────────────────────────

        for (const f of failed) {
            const branch = this.branches.find(b => b.name === f.branchName);

            if (branch?.critical) {
                throw new Error(
                    `Critical tremor branch "${f.branchName}" failed: ${f.error?.message}`
                );
            }

            const decision = this.fanIn.onBranchFailure(f, succeeded, ctx);
            console.log(
                `[ParallelTremor] branch "${f.branchName}" failed: ${f.error?.message} → ${decision}`
            );
            if (decision === "abort") {
                throw new Error(
                    `Parallel tremor aborted: ${f.branchName} failed critically`
                );
            }
        }

        // ── Fan in: merge results ──────────────────────────────────────

        let merged: string;

        if (this.fanIn instanceof AgenticMergeFanIn) {
            merged = await this.fanIn.mergeAsync(succeeded, ctx);
        } else {
            merged = this.fanIn.merge(succeeded, ctx);
        }

        // ── Store on context ───────────────────────────────────────────

        ctx.tremorResult = {
            text: merged,
            steps: succeeded.flatMap(r => r.toolResults),
        } as AgentResult;

        ctx.toolCallCount += succeeded.reduce(
            (sum, r) => sum + r.toolCalls, 0
        );

        ctx.eternalSignal = extractEternalSignal(merged);
        ctx.metadata.isDramatic = isDramatic;
        ctx.metadata.tremorBranchResults = succeeded;
        ctx.metadata.tremorFailedBranches = failed.map(f => f.branchName);

        console.log(
            `[ParallelTremor] ${succeeded.length}/${this.branches.length} branches succeeded | ` +
            `${ctx.toolCallCount} total tool calls`
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
                toolChoice: {
                    allowedTools: branch.tools,
                },
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
                            `[Tremor:${branch.name}] tool: ${name} | result: ${preview}`
                        );
                    });
                    console.log(
                        `[Tremor:${branch.name}] tokens: ${usage?.inputTokens}in / ${usage?.outputTokens}out | finish: ${finishReason}`
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
