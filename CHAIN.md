# Chain of Responsibility Refactor — Implementation Guide

## Overview

This document describes the full refactor of the Saint Engine's turn pipeline from a
sequential, hardcoded step chain into a **conditional chain of responsibility** with
**parallel fan-out / fan-in** for Tremor and Witness agents.

### Current Architecture (Before)

runTurn():
Step 1 - Herald Agent
Step 2 - Tremor (1 agent, 16 tools sequentially)
Step 3 - Eternal (conditional on significance)
Step 4 - NPC Agents (parallel, optional)
Step 5 - Witness (1 agent, 16 tools sequentially)
Step 6 - Prose Agent
Step 6 — Persist and return

### New Architecture (After)

AgentChain.execute():
Link 10 — Herald (conditional: significance + phase + session state)
Link 20 — ParallelTremor (4 agents × 4 tools, concurrent)
Link 30 — NpcAgents (optional)
Link 40 — Eternal (conditional on significance)
Link 50 — ParallelWitness (4 agents × 4 tools, concurrent)
LInk 55 - Dialogue Agent
Link 60 — Prose Agent


Each link is a self-contained class with its own conditions, error handling,
skip behavior, and lifecycle hooks. Links communicate through a shared
`ChainContext` object. The chain executor sorts by priority and runs them
in order, skipping or terminating based on each link's decisions.

---

## Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/agentic/game/chain/types.ts` | All shared types, enums, interfaces |
| 2 | `src/agentic/game/chain/base-chain-link.ts` | Abstract base class with lifecycle hooks |
| 3 | `src/agentic/game/chain/agent-chain.ts` | Chain executor (sort, validate, run) |
| 4 | `src/agentic/game/chain/fan-in-strategies.ts` | Merge strategies for parallel links |
| 5 | `src/agentic/game/chain/links/tremor-link.ts` | Single-agent Tremor link |
| 6 | `src/agentic/game/chain/links/parallel-tremor-link.ts` | Fan-out Tremor link |
| 7 | `src/agentic/game/chain/links/npc-agents-link.ts` | NPC agents link |
| 8 | `src/agentic/game/chain/links/herald-link.ts` | Conditional Herald link |
| 9 | `src/agentic/game/chain/links/eternal-link.ts` | Conditional Eternal link |
| 10 | `src/agentic/game/chain/links/witness-link.ts` | Single-agent Witness link |
| 11 | `src/agentic/game/chain/links/parallel-witness-link.ts` | Fan-out Witness link |
| 12 | `src/agentic/game/chain/links/prose-link.ts` | Prose generation link |
| 13 | `src/agentic/game/chain/index.ts` | Barrel export |

## Files to Refactor

| # | File | Changes |
|---|------|---------|
| 1 | `src/agentic/game/saint-engine.ts` | Replace sequential steps with chain; add builder methods |
| 2 | `src/lib/session-engine.ts` | Update `buildEngineForGame` to use new builder API |

---

## File 1 — `src/agentic/game/chain/types.ts`

All shared types used across the chain system. This file has zero imports from
other chain files — it is the leaf dependency.

```typescript
// src/agentic/game/chain/types.ts

// ── Chain execution ────────────────────────────────────────────────────────

export enum ChainAction {
    /** Agent acted. Pass to the next link. */
    HANDLED_CONTINUE = "handled_continue",

    /** Agent acted. Stop the chain here. */
    HANDLED_TERMINATE = "handled_terminate",

    /** Agent chose not to act. Pass to the next link unchanged. */
    SKIPPED = "skipped",
}

// ── Progress callback ──────────────────────────────────────────────────────

export interface ProgressUpdate {
    phase: string;
    message: string;
}

export type ProgressCallback = (update: ProgressUpdate) => void;

// ── Mutation (accumulated during chain, applied after) ─────────────────────

export interface Mutation {
    type: string;        // e.g., "narrative_state", "player_session"
    field: string;       // e.g., "narrative_entropy"
    value: unknown;
    source: string;      // link name that produced it
}

// ── Narrative state (loaded from DB, read by chain) ────────────────────────

export interface NarrativeState {
    current_phase: string;
    phase_charge: number;
    narrative_entropy: number;
    archetype_cohesion: number;
    player_resonance: number;
    inertia_resistance: number;
    point_of_no_return: number;
    pull_conflict: number;
    story_pace: number;
    breaking_point: number;
    event_distortion: number;
    world_awareness: number;
}

// ── Player session (loaded from DB, read by chain) ────────────────────────

export interface PlayerSession {
    moral_stance: number;
    approach: number;
    scale: number;
    foresight: number;
    pull_on_world: number[];
    idea_amplification: Record<string, unknown>;
    stability_effect: number;
}

// ── Eternal signal (extracted from Tremor output) ──────────────────────────

export interface EternalSignal {
    text: string;
    significance: number;
    source?: string;
}

// ── Turn input (passed into the chain) ─────────────────────────────────────

export interface TurnInput {
    sessionId: string;
    gameId: string;
    playerId: string;
    turnNumber: number;
    playerInput: string;
    worldImpact?: Record<string, unknown>;
    genre?: string;
    onProgress?: ProgressCallback;
}

// ── Agent result (wrapper around whatever your agent library returns) ──────

export interface AgentResult {
    text: string;
    steps?: unknown[];
    reasoningText?: string;
    toolCalls?: unknown[];
    toolResults?: unknown[];
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

// ── Narrative option (extracted from Witness output) ───────────────────────

export interface NarrativeOption {
    id: string;
    text: string;
    type: string;
    metadata?: Record<string, unknown>;
}

// ── Tool result (for parallel branch accumulation) ─────────────────────────

export interface ToolResult {
    toolName: string;
    result: unknown;
}

// ── Parallel branch ────────────────────────────────────────────────────────

export interface ParallelBranch {
    name: string;
    agent: AgenticAgent;           // your agent type
    tools: string[];               // which tools this agent owns
    promptBuilder: (ctx: ChainContext) => string;
    maxSteps: number;
    critical?: boolean;            // if true, branch failure aborts the link
}

export interface ParallelResult {
    branchName: string;
    text: string;
    toolCalls: number;
    toolResults: ToolResult[];
    error?: Error;
}

// ── Fan-in strategy ────────────────────────────────────────────────────────

export interface FanInStrategy {
    merge(results: ParallelResult[], ctx: ChainContext): string;
    onBranchFailure(
        failed: ParallelResult,
        succeeded: ParallelResult[],
        ctx: ChainContext
    ): "continue" | "abort";
}

// ── Chain context (shared mutable state passed through the chain) ──────────

export interface ChainContext {
    input: TurnInput;
    state: NarrativeState;
    player: PlayerSession;
    mutations: Mutation[];

    // Agent results (set by links, read by downstream links)
    tremorResult: AgentResult | null;
    eternalSignal: EternalSignal | null;
    eternalResult: AgentResult | null;
    npcResults: NpcBatchResult | null;
    witnessResult: AgentResult | null;
    proseResult: AgentResult | null;
    heraldText: string | null;

    // Derived state
    phaseState: NarrativeState | null;
    options: NarrativeOption[];

    // Bookkeeping
    toolCallCount: number;
    metadata: Record<string, unknown>;
    onProgress?: ProgressCallback;
}

// ── NpcBatchResult (from your existing npc runner) ─────────────────────────

export interface NpcBatchResult {
    results: AgentResult[];
    totalToolCalls: number;
}

// ── AgenticAgent (interface your agent library must satisfy) ───────────────

export interface AgenticAgent {
    generate(
        messages: Array<{ role: string; content: string }>,
        options?: {
            maxSteps?: number;
            toolChoice?: { allowedTools?: string[] };
            onStepFinish?: (event: {
                text?: string;
                toolCalls?: Array<{ payload?: { toolName?: string } }>;
                toolResults?: Array<{ payload?: { result?: unknown } }>;
                finishReason?: string;
                usage?: { inputTokens: number; outputTokens: number };
            }) => void;
        }
    ): Promise<AgentResult>;
}

// ── Runtime gate (for runtime-conditional chains) ──────────────────────────

export type RuntimeGate = (state: NarrativeState) => boolean;

// ── Phase state alias (same as NarrativeState, used for readability) ───────

export type PhaseState = NarrativeState;
```

## File 2 — src/agentic/game/chain/base-chain-link.ts

Abstract base class. Every link inherits from this. Provides sensible defaults
for all lifecycle hooks so a minimal link only needs `name`, `priority`,
`canHandle`, and `handle`.

```typescript
// src/agentic/game/chain/base-chain-link.ts

import { ChainAction, ChainContext } from "./types";

// ── Chain link contract ────────────────────────────────────────────────────

export interface ChainLink {
    readonly name: string;
    readonly priority: number;

    shouldConsider(ctx: ChainContext): boolean;
    canHandle(ctx: ChainContext): ChainAction;
    handle(ctx: ChainContext): Promise<void>;

    // Optional lifecycle hooks
    beforeHandle?(ctx: ChainContext): Promise<void>;
    afterHandle?(ctx: ChainContext): Promise<void>;
    onSkip?(ctx: ChainContext): void;
    onError?(ctx: ChainContext, error: Error): ChainAction | Promise<ChainAction>;
    shouldTerminateAfter?(ctx: ChainContext): boolean;
    weight?(ctx: ChainContext): number;
    dependencies?(): string[];
}

// ── Base implementation ────────────────────────────────────────────────────

export abstract class BaseChainLink implements ChainLink {
    abstract readonly name: string;
    abstract readonly priority: number;

    /**
     * Cheap pre-check. Runs before canHandle.
     * Default: always consider.
     *
     * Use for: null checks, phase gates, feature flags.
     * Should NOT: call agents, read DB, do anything expensive.
     */
    shouldConsider(_ctx: ChainContext): boolean {
        return true;
    }

    /**
     * Full evaluation. Returns the action to take.
     * Runs after shouldConsider returns true.
     *
     * Use for: threshold checks, state comparisons, multi-condition gates.
     * Should NOT: call agents (that's handle's job).
     */
    abstract canHandle(ctx: ChainContext): ChainAction;

    /**
     * Optional setup before the agent runs.
     * Runs after canHandle returns HANDLED_CONTINUE or HANDLED_TERMINATE.
     *
     * Use for: loading data, warming caches, computing derived values.
     */
    async beforeHandle(_ctx: ChainContext): Promise<void> {
        // Default: no-op
    }

    /**
     * The actual work. Runs the agent, mutates context.
     *
     * Use for: agent calls, tool invocations, mutation accumulation.
     */
    abstract handle(ctx: ChainContext): Promise<void>;

    /**
     * Post-processing after handle completes.
     * Runs even if handle was overridden in a subclass.
     *
     * Use for: validation, enrichment, logging, side effects.
     */
    async afterHandle(_ctx: ChainContext): Promise<void> {
        // Default: no-op
    }

    /**
     * React to being skipped (shouldConsider=false or canHandle=SKIPPED).
     *
     * Use for: setting defaults, signaling downstream, debug logging.
     */
    onSkip(_ctx: ChainContext): void {
        // Default: no-op
    }

    /**
     * Handle errors thrown during handle().
     * Return the action the chain should take.
     *
     * Default: re-throw (chain aborts).
     */
    onError(_ctx: ChainContext, error: Error): ChainAction | Promise<ChainAction> {
        throw error;
    }

    /**
     * Post-execution termination check.
     * Runs after handle + afterHandle complete.
     *
     * Use for: confirming that a predicted termination should actually happen.
     */
    shouldTerminateAfter(_ctx: ChainContext): boolean {
        return false;
    }

    /**
     * Dynamic priority weight. Higher = more urgent.
     * Combined with static priority for sorting.
     *
     * Use for: links whose urgency changes with game state.
     */
    weight(_ctx: ChainContext): number {
        return 1.0;
    }

    /**
     * Declare which other links must run before this one.
     * Validated at chain construction time.
     *
     * Use for: data dependencies between links.
     */
    dependencies(): string[] {
        return [];
    }
}
```

## File 3 — src/agentic/game/chain/agent-chain.ts

The chain executor. Sorts links, validates dependencies, runs the lifecycle.

```typescript

// src/agentic/game/chain/agent-chain.ts

import { ChainLink, BaseChainLink } from "./base-chain-link";
import { ChainAction, ChainContext } from "./types";

// ── Chain executor ─────────────────────────────────────────────────────────

export class AgentChain {
    private links: ChainLink[];

    constructor(links: ChainLink[]) {
        this.links = [...links].sort(
            (a, b) => a.priority - b.priority
        );
        this.validateDependencies();
        this.validateUniqueNames();
    }

    /**
     * Execute the full chain against the given context.
     * Links run in priority order. Each link decides whether to act,
     * skip, or terminate the chain.
     */
    async execute(ctx: ChainContext): Promise<ChainContext> {
        for (const link of this.links) {
            // ── Dependency check ───────────────────────────────────────
            const deps = link.dependencies?.() ?? [];
            const missingDeps = deps.filter(
                d => !ctx.metadata[`link_${d}_executed`]
            );
            if (missingDeps.length > 0) {
                console.log(
                    `[Chain] ${link.name} — skipped (missing deps: ${missingDeps.join(", ")})`
                );
                link.onSkip?.(ctx);
                continue;
            }

            // ── shouldConsider ─────────────────────────────────────────
            if (!link.shouldConsider(ctx)) {
                console.log(
                    `[Chain] ${link.name} — skipped (shouldConsider=false)`
                );
                link.onSkip?.(ctx);
                continue;
            }

            // ── canHandle ──────────────────────────────────────────────
            let action: ChainAction;
            try {
                action = link.canHandle(ctx);
            } catch (error) {
                console.error(
                    `[Chain] ${link.name} — canHandle threw: ${error}`
                );
                const recovery = await this.safeOnError(link, ctx, error as Error);
                if (recovery === ChainAction.HANDLED_TERMINATE) break;
                continue;
            }

            if (action === ChainAction.SKIPPED) {
                console.log(
                    `[Chain] ${link.name} — skipped (canHandle=SKIPPED)`
                );
                link.onSkip?.(ctx);
                continue;
            }

            // ── beforeHandle ───────────────────────────────────────────
            try {
                await link.beforeHandle?.(ctx);
            } catch (error) {
                console.error(
                    `[Chain] ${link.name} — beforeHandle threw: ${error}`
                );
                const recovery = await this.safeOnError(link, ctx, error as Error);
                if (recovery === ChainAction.HANDLED_TERMINATE) break;
                continue;
            }

            // ── handle ─────────────────────────────────────────────────
            console.log(`[Chain] ${link.name} — executing`);
            try {
                await link.handle(ctx);
            } catch (error) {
                console.error(
                    `[Chain] ${link.name} — handle threw: ${error}`
                );
                const recovery = await this.safeOnError(
                    link, ctx, error as Error
                );
                if (recovery === ChainAction.HANDLED_TERMINATE) break;
                if (recovery === ChainAction.SKIPPED) continue;
                // HANDLED_CONTINUE — fall through to afterHandle
            }

            // ── afterHandle ────────────────────────────────────────────
            try {
                await link.afterHandle?.(ctx);
            } catch (error) {
                console.error(
                    `[Chain] ${link.name} — afterHandle threw: ${error}`
                );
                // afterHandle errors don't stop the chain by default
            }

            // ── Mark as executed (for dependency tracking) ─────────────
            ctx.metadata[`link_${link.name}_executed`] = true;

            // ── Termination check ──────────────────────────────────────
            const shouldStop =
                action === ChainAction.HANDLED_TERMINATE ||
                (link.shouldTerminateAfter?.(ctx) ?? false);

            if (shouldStop) {
                console.log(
                    `[Chain] ${link.name} — terminated chain | ` +
                    `${ctx.mutations.length} mutations accumulated`
                );
                break;
            }
        }

        return ctx;
    }

    /**
     * Inspect the chain without executing. Useful for debugging.
     */
    describe(): Array<{ name: string; priority: number }> {
        return this.links.map(l => ({
            name: l.name,
            priority: l.priority,
        }));
    }

    // ── Private ───────────────────────────────────────────────────────────

    private validateDependencies(): void {
        const names = new Set(this.links.map(l => l.name));

        for (const link of this.links) {
            for (const dep of link.dependencies?.() ?? []) {
                if (!names.has(dep)) {
                    throw new Error(
                        `Chain link "${link.name}" depends on "${dep}" ` +
                        `which is not in the chain`
                    );
                }

                const depLink = this.links.find(l => l.name === dep)!;
                if (depLink.priority > link.priority) {
                    throw new Error(
                        `Chain link "${link.name}" (priority ${link.priority}) ` +
                        `depends on "${dep}" (priority ${depLink.priority}) ` +
                        `but runs before it`
                    );
                }
            }
        }
    }

    private validateUniqueNames(): void {
        const names = new Set<string>();
        for (const link of this.links) {
            if (names.has(link.name)) {
                throw new Error(
                    `Duplicate chain link name: "${link.name}"`
                );
            }
            names.add(link.name);
        }
    }

    private async safeOnError(
        link: ChainLink,
        ctx: ChainContext,
        error: Error
    ): Promise<ChainAction> {
        try {
            const result = link.onError?.(ctx, error);
            return result instanceof Promise ? await result : (result ?? ChainAction.HANDLED_TERMINATE);
        } catch (onErrorError) {
            console.error(
                `[Chain] ${link.name} — onError also threw: ${onErrorError}`
            );
            return ChainAction.HANDLED_TERMINATE;
        }
    }
}
```

## File 4 — src/agentic/game/chain/fan-in-strategies.ts

Three strategies for merging parallel branch results into a single signal.

```typescript

// src/agentic/game/chain/fan-in-strategies.ts

import { FanInStrategy, ParallelResult, ChainContext, AgenticAgent } from "./types";

// ── Strategy 1: Concatenated ───────────────────────────────────────────────
// Simple: each branch output becomes a labeled section.
// Use when: branches are independent and you want all raw output.

export class ConcatenatedFanIn implements FanInStrategy {
    merge(results: ParallelResult[], _ctx: ChainContext): string {
        return results
            .map(r => `[${r.branchName}]\n${r.text}`)
            .join("\n\n---\n\n");
    }

    onBranchFailure(
        _failed: ParallelResult,
        _succeeded: ParallelResult[],
        _ctx: ChainContext
    ): "continue" | "abort" {
        return "continue";
    }
}

// ── Strategy 2: Priority merge ─────────────────────────────────────────────
// Higher-priority branches win conflicts.
// Use when: branches might produce contradictory signals.

export class PriorityMergeFanIn implements FanInStrategy {
    constructor(
        private priorityOrder: string[]  // branch names, highest priority first
    ) {}

    merge(results: ParallelResult[], _ctx: ChainContext): string {
        const ordered = this.priorityOrder
            .map(name => results.find(r => r.branchName === name))
            .filter(Boolean) as ParallelResult[];

        if (ordered.length === 0) return "";

        const [anchor, ...rest] = ordered;
        let merged = anchor.text;

        for (const r of rest) {
            merged += `\n\n[Additional context from ${r.branchName}]\n${r.text}`;
        }

        return merged;
    }

    onBranchFailure(
        _failed: ParallelResult,
        _succeeded: ParallelResult[],
        _ctx: ChainContext
    ): "continue" | "abort" {
        return "continue";
    }
}

// ── Strategy 3: Agentic merge ──────────────────────────────────────────────
// Uses a lightweight model to synthesize branch outputs into one signal.
// Use when: branches produce rich, overlapping output that needs synthesis.

export class AgenticMergeFanIn implements FanInStrategy {
    constructor(
        private mergeAgent: AgenticAgent,
        private maxSteps: number = 3,
    ) {}

    merge(results: ParallelResult[], _ctx: ChainContext): string {
        // Sync fallback — concatenate if called synchronously
        return results.map(r => r.text).join("\n");
    }

    onBranchFailure(
        _failed: ParallelResult,
        _succeeded: ParallelResult[],
        _ctx: ChainContext
    ): "continue" | "abort" {
        return "continue";
    }

    /**
     * Async merge — call this directly from the parallel link's handle()
     * instead of using the sync merge().
     */
    async mergeAsync(
        results: ParallelResult[],
        _ctx: ChainContext
    ): Promise<string> {
        const combined = results
            .map(r => `### ${r.branchName}\n${r.text}`)
            .join("\n\n");

        const result = await this.mergeAgent.generate([{
            role: "user",
            content: [
                "Synthesize these parallel observations into a single coherent signal.",
                "Each section came from a different perspective. Combine them,",
                "resolve any contradictions, and produce one unified narrative signal.",
                "",
                combined,
                "",
                "Unified signal:",
            ].join("\n"),
        }], { maxSteps: this.maxSteps });

        return result.text;
    }
}
```

## File 5 — src/agentic/game/chain/links/tremor-link.ts

Single-agent Tremor. Use this when you don't need parallel fan-out.

```typescript

// src/agentic/game/chain/links/tremor-link.ts

import { BaseChainLink } from "../base-chain-link";
import {
    ChainAction,
    ChainContext,
    AgenticAgent,
    AgentResult,
    ProgressCallback,
} from "../types";

// ── Helpers (move to a shared utils file if used elsewhere) ────────────────

const tremorMessages = [
    "A ripple passes through the world…",
    "Something shifts beneath the surface…",
    "The ground hums with tension…",
];

function countToolCalls(result: AgentResult): number {
    return result.toolCalls?.length ?? 0;
}

function extractEternalSignal(text: string): {
    text: string;
    significance: number;
} | null {
    // Your existing extraction logic
    const match = text.match(/$$ETERNAL_SIGNAL$$(.*?)$$\/ETERNAL_SIGNAL$$/s);
    if (!match) return null;

    const sigMatch = match[1].match(/significance:\s*([\d.]+)/);
    return {
        text: match[1].trim(),
        significance: sigMatch ? parseFloat(sigMatch[1]) : 0,
    };
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

        const result = await this.agent.generate(
            [{ role: "user", content: this.buildPrompt(ctx.input) }],
            {
                maxSteps: this.config.maxSteps,
                onStepFinish: ({ toolCalls, toolResults, finishReason, usage }) => {
                    toolCalls?.forEach((tc, i) => {
                        const name = tc.payload?.toolName ?? "unknown";
                        const toolResult = toolResults?.[i];
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
```

## File 6 — src/agentic/game/chain/links/parallel-tremor-link.ts

Fan-out Tremor. Runs N agents in parallel, each with its own tool subset,
then merges results.

```typescript
// src/agentic/game/chain/links/parallel-tremor-link.ts

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
    "A ripple passes through the world…",
    "Something shifts beneath the surface…",
    "The ground hums with tension…",
];

function countToolCalls(result: AgentResult): number {
    return result.toolCalls?.length ?? 0;
}

function extractToolResults(result: AgentResult): ParallelResult["toolResults"] {
    if (!result.toolCalls || !result.toolResults) return [];
    return result.toolCalls.map((tc: any, i: number) => ({
        toolName: tc.payload?.toolName ?? "unknown",
        result: result.toolResults![i],
    }));
}

function extractEternalSignal(text: string): {
    text: string;
    significance: number;
} | null {
    const match = text.match(/$$ETERNAL_SIGNAL$$(.*?)$$\/ETERNAL_SIGNAL$$/s);
    if (!match) return null;
    const sigMatch = match[1].match(/significance:\s*([\d.]+)/);
    return {
        text: match[1].trim(),
        significance: sigMatch ? parseFloat(sigMatch[1]) : 0,
    };
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
        // ── Progress message ───────────────────────────────────────────

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

            // Critical branch failure aborts immediately
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
        const prompt = branch.promptBuilder(ctx);

        const result = await branch.agent.generate(
            [{ role: "user", content: prompt }],
            {
                maxSteps: branch.maxSteps,
                toolChoice: {
                    allowedTools: branch.tools,
                },
                onStepFinish: ({ toolCalls, toolResults, finishReason, usage }) => {
                    toolCalls?.forEach((tc, i) => {
                        const name = tc.payload?.toolName ?? "unknown";
                        const toolResult = toolResults?.[i];
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
```

## File 7 — src/agentic/game/chain/links/npc-agents-link.ts

Runs NPC agents. Wraps your existing runNpcAgents function.

```typescript

// src/agentic/game/chain/links/npc-agents-link.ts

import { BaseChainLink } from "../base-chain-link";
import { ChainAction, ChainContext, NpcBatchResult } from "../types";

// ── NPC Agents link ────────────────────────────────────────────────────────

export class NpcAgentsLink extends BaseChainLink {
    readonly name = "npc_agents";
    readonly priority = 20;

    constructor(
        private npcAgentIds: string[],
        private runNpcAgents: (
            sessionId: string,
            ids: string[]
        ) => Promise<NpcBatchResult>,
    ) {
        super();
    }

    shouldConsider(_ctx: ChainContext): boolean {
        return this.npcAgentIds.length > 0;
    }

    canHandle(_ctx: ChainContext): ChainAction {
        return ChainAction.HANDLED_CONTINUE;
    }

    onSkip(ctx: ChainContext): void {
        console.log("[NPC] No NPC agent IDs configured — skipping");
        ctx.npcResults = { results: [], totalToolCalls: 0 };
    }

    async handle(ctx: ChainContext): Promise<void> {
        const results = await this.runNpcAgents(
            ctx.input.sessionId,
            this.npcAgentIds
        );
        ctx.npcResults = results;
        ctx.toolCallCount += results.totalToolCalls;
        console.log("===NPC Results===", results);
    }
}
```

## File 8 — src/agentic/game/chain/links/herald-link.ts

Conditional Herald. Only fires when significance, phase, and session state
all pass their checks.

```typescript
// src/agentic/game/chain/links/herald-link.ts

import { BaseChainLink } from "../base-chain-link";
import {
    ChainAction,
    ChainContext,
    AgenticAgent,
    AgentResult,
} from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

function countToolCalls(result: AgentResult): number {
    return result.toolCalls?.length ?? 0;
}

// ── Herald config ──────────────────────────────────────────────────────────

export interface HeraldConfig {
    maxSteps: number;
    significanceThreshold: number;
    allowedPhases: string[];
}

// ── Herald link ────────────────────────────────────────────────────────────

export class HeraldLink extends BaseChainLink {
    readonly name = "herald";
    readonly priority = 25;

    constructor(
        private agent: AgenticAgent,
        private config: HeraldConfig,
        private buildPrompt: (signal: NonNullable<ChainContext["eternalSignal"]>) => string,
    ) {
        super();
    }

    /**
     * Cheap gate: skip if no signal exists at all.
     */
    shouldConsider(ctx: ChainContext): boolean {
        return ctx.eternalSignal !== null;
    }

    /**
     * Full evaluation. All three conditions must pass:
     *   1. significance >= threshold
     *   2. current_phase in allowedPhases
     *   3. herald hasn't already spoken this session
     */
    canHandle(ctx: ChainContext): ChainAction {
        const signal = ctx.eternalSignal;
        if (!signal) return ChainAction.SKIPPED;

        // Condition 1: significance
        if (signal.significance < this.config.significanceThreshold) {
            console.log(
                `[Herald] significance ${signal.significance} < ` +
                `${this.config.significanceThreshold} — skipping`
            );
            return ChainAction.SKIPPED;
        }

        // Condition 2: phase
        const currentPhase = ctx.phaseState?.current_phase;
        if (currentPhase && !this.config.allowedPhases.includes(currentPhase)) {
            console.log(
                `[Herald] phase "${currentPhase}" not in allowed phases — skipping`
            );
            return ChainAction.SKIPPED;
        }

        // Condition 3: already spoke
        if (ctx.metadata.heraldAlreadySpoke === true) {
            console.log("[Herald] already spoke this session — skipping");
            return ChainAction.SKIPPED;
        }

        return ChainAction.HANDLED_CONTINUE;
    }

    onSkip(ctx: ChainContext): void {
        ctx.metadata.heraldEvaluated = true;
        ctx.metadata.heraldSkipped = true;
        ctx.heraldText = null;
    }

    async handle(ctx: ChainContext): Promise<void> {
        ctx.onProgress?.({ phase: "herald", message: "Something stirs…" });

        const result = await this.agent.generate(
            [{ role: "user", content: this.buildPrompt(ctx.eternalSignal!) }],
            {
                maxSteps: this.config.maxSteps,
                onStepFinish: ({ toolCalls, toolResults, finishReason, usage }) => {
                    toolCalls?.forEach((tc, i) => {
                        const name = tc.payload?.toolName ?? "unknown";
                        const toolResult = toolResults?.[i];
                        const preview = toolResult
                            ? JSON.stringify(
                                  toolResult.payload?.result ?? toolResult.payload ?? toolResult
                              ).slice(0, 120)
                            : "no result";
                        console.log(`[===Herald===] tool: ${name} | result: ${preview}`);
                    });
                    console.log(
                        `[===Herald===] tokens: ${usage?.inputTokens}in / ${usage?.outputTokens}out | finish: ${finishReason}`
                    );
                },
            }
        );

        ctx.heraldText = result.text;
        ctx.toolCallCount += countToolCalls(result);
        ctx.metadata.heraldSpokeThisTurn = true;
    }
}
```

## File 9 — src/agentic/game/chain/links/eternal-link.ts

Conditional Eternal. Fires when the tremor signal meets the significance
threshold.

```typescript

// src/agentic/game/chain/links/eternal-link.ts

import { BaseChainLink } from "../base-chain-link";
import {
    ChainAction,
    ChainContext,
    AgenticAgent,
    AgentResult,
} from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

const eternalMessages = [
    "The Eternal takes notice…",
    "Something is written into the record…",
    "A weight settles on the world…",
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

    onSkip(ctx: ChainContext): void {
        console.log(
            `[Eternal] significance too low or no signal — skipping`
        );
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
                    toolCalls?.forEach((tc, i) => {
                        const name = tc.payload?.toolName ?? "unknown";
                        const toolResult = toolResults?.[i];
                        const preview = toolResult
                            ? JSON.stringify(
                                  toolResult.payload?.result ?? toolResult.payload ?? toolResult
                              ).slice(0, 120)
                            : "no result";
                        console.log(
                            `[===Eternal===] tool: ${name} | result: ${preview}`
                        );
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
```

## File 10 — src/agentic/game/chain/links/witness-link.ts

Single-agent Witness. Use this when you don't need parallel fan-out.

```typescript

// src/agentic/game/chain/links/witness-link.ts

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
    "The Witness observes…",
    "Patterns emerge from the noise…",
    "A new path is illuminated…",
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

        const prompt = await this.buildPrompt(ctx.input);

        const result = await this.agent.generate(
            [{ role: "user", content: prompt }],
            {
                maxSteps: this.config.maxSteps,
                onStepFinish: ({ toolCalls, toolResults, finishReason, usage }) => {
                    toolCalls?.forEach((tc, i) => {
                        const name = tc.payload?.toolName ?? "unknown";
                        const toolResult = toolResults?.[i];
                        const preview = toolResult
                            ? JSON.stringify(
                                  toolResult.payload?.result ?? toolResult.payload ?? toolResult
                              ).slice(0, 120)
                            : "no result";
                        console.log(
                            `[===Witness===] tool: ${name} | result: ${preview}`
                        );
                    });
                    console.log(
                        `[===Witness===] tokens: ${usage?.inputTokens}in / ${usage?.outputTokens}out | finish: ${finishReason}`
                    );
                },
            }
        );

        ctx.witnessResult = result;
        ctx.toolCallCount += countToolCalls(result);
        ctx.options = this.extractOptions(result);
        ctx.phaseState = await this.readPhaseState(ctx.input.sessionId);
    }
}
```

## File 11 — src/agentic/game/chain/links/parallel-witness-link.ts

Fan-out Witness. Runs N agents in parallel, each with its own tool subset,
then merges results.

```typescript

// src/agentic/game/chain/links/parallel-witness-link.ts

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

const witnessMessages = [
    "The Witness observes…",
    "Patterns emerge from the noise…",
    "A new path is illuminated…",
];

function countToolCalls(result: AgentResult): number {
    return result.toolCalls?.length ?? 0;
}

function extractToolResults(result: AgentResult): ParallelResult["toolResults"] {
    if (!result.toolCalls || !result.toolResults) return [];
    return result.toolCalls.map((tc: any, i: number) => ({
        toolName: tc.payload?.toolName ?? "unknown",
        result: result.toolResults![i],
    }));
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
        const prompt = branch.promptBuilder(ctx);

        const result = await branch.agent.generate(
            [{ role: "user", content: prompt }],
            {
                maxSteps: branch.maxSteps,
                toolChoice: { allowedTools: branch.tools },
                onStepFinish: ({ toolCalls, toolResults, finishReason, usage }) => {
                    toolCalls?.forEach((tc, i) => {
                        const name = tc.payload?.toolName ?? "unknown";
                        const toolResult = toolResults?.[i];
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
```

## File 12 — src/agentic/game/chain/links/prose-link.ts

Prose agent. Always runs last. Generates the scene description from the
witness output.

```typescript

// src/agentic/game/chain/links/prose-link.ts

import { BaseChainLink } from "../base-chain-link";
import {
    ChainAction,
    ChainContext,
    AgenticAgent,
    AgentResult,
    NarrativeOption,
    PhaseState,
} from "../types";

// ── Prose link ─────────────────────────────────────────────────────────────

export class ProseLink extends BaseChainLink {
    readonly name = "prose";
    readonly priority = 50;

    constructor(
        private agent: AgenticAgent,
        private buildPrompt: (
            input: ChainContext["input"],
            witnessText: string,
            options: NarrativeOption[],
            phaseState: PhaseState | null,
        ) => string,
        private cleanProseResult: (text: string) => string,
    ) {
        super();
    }

    canHandle(ctx: ChainContext): ChainAction {
        return ctx.witnessResult !== null
            ? ChainAction.HANDLED_CONTINUE
            : ChainAction.SKIPPED;
    }

    onSkip(ctx: ChainContext): void {
        console.log("[Prose] No witness result — cannot generate prose");
        ctx.metadata.cleanSceneDescription = "The scene remains unwritten.";
    }

    async handle(ctx: ChainContext): Promise<void> {
        ctx.onProgress?.({ phase: "prose", message: "Finding the words…" });

        const result = await this.agent.generate([{
            role: "user",
            content: this.buildPrompt(
                ctx.input,
                ctx.witnessResult!.text,
                ctx.options,
                ctx.phaseState
            ),
        }]);

        ctx.proseResult = result;
        // Prose agent has no tools — 0 additional tool calls

        console.log("===Prose Result===", result.text);
        console.log("===Prose Reasoning===", result.reasoningText);

        const clean = this.cleanProseResult(result.text);
        console.log("===Clean Scene Description===", clean);

        ctx.metadata.cleanSceneDescription = clean;
    }
}
```

## File 13 — src/agentic/game/chain/index.ts

Barrel export.

```typescript

// src/agentic/game/chain/index.ts

// Types
export * from "./types";

// Base
export { BaseChainLink } from "./base-chain-link";
export type { ChainLink } from "./base-chain-link";

// Executor
export { AgentChain } from "./agent-chain";

// Fan-in strategies
export {
    ConcatenatedFanIn,
    PriorityMergeFanIn,
    AgenticMergeFanIn,
} from "./fan-in-strategies";

// Links
export { TremorLink } from "./links/tremor-link";
export { ParallelTremorLink } from "./links/parallel-tremor-link";
export { NpcAgentsLink } from "./links/npc-agents-link";
export { HeraldLink } from "./links/herald-link";
export type { HeraldConfig } from "./links/herald-link";
export { EternalLink } from "./links/eternal-link";
export { WitnessLink } from "./links/witness-link";
export { ParallelWitnessLink } from "./links/parallel-witness-link";
export { ProseLink } from "./links/prose-link";
```

## File Refactor 1 — src/agentic/game/saint-engine.ts

Replace the sequential runTurn steps with an AgentChain. Add a
buildChain() method and a builder API for configuring conditional links.


What changes

1.Remove the inline step-by-step logic from runTurn()
2.Add private chain: AgentChain field
3.Add private buildChain(): AgentChain method
4.Add static builder(): EngineBuilder method
5.Add private constructor(...) to enforce builder usage
6._internalBuild() becomes the only way to construct

Full refactored file

```typescript
// src/agentic/game/saint-engine.ts

import {
    AgentChain,
    BaseChainLink,
    ChainContext,
    ChainAction,
    TurnInput,
    TurnResult,
    AgentResult,
    NarrativeState,
    NarrativeOption,
    PhaseState,
    AgenticAgent,
    NpcBatchResult,
    ParallelBranch,
    FanInStrategy,
    // Links
    TremorLink,
    ParallelTremorLink,
    NpcAgentsLink,
    HeraldLink,
    HeraldConfig,
    EternalLink,
    WitnessLink,
    ParallelWitnessLink,
    ProseLink,
    // Strategies
    ConcatenatedFanIn,
    PriorityMergeFanIn,
    AgenticMergeFanIn,
} from "./chain";

// ── Engine config ──────────────────────────────────────────────────────────

export interface EngineConfig {
    powerModel: string;
    fastModel: string;
    genre: string;
    eternalThreshold: number;
    tremorMaxSteps: number;
    eternalMaxSteps: number;
    witnessMaxSteps: number;
    heraldMaxSteps: number;
    proseMaxSteps: number;
    phaseThresholds: Record<string, number>;
    npcAgentIds: string[];
    maxSteps: number[];

    // Parallel config
    tremorBranches?: ParallelBranch[];
    witnessBranches?: ParallelBranch[];
    tremorFanIn?: FanInStrategy;
    witnessFanIn?: FanInStrategy;

    // Herald config
    heraldSignificanceThreshold?: number;
    heraldAllowedPhases?: string[];

    // Chain links (populated by builder)
    chainLinks?: BaseChainLink[];

    // Runtime-gated chains
    runtimeGatedChains?: Array<{
        links: BaseChainLink[];
        gate: (state: NarrativeState) => boolean;
    }>;
}

// ── Turn result ────────────────────────────────────────────────────────────

export interface TurnResult {
    beat: unknown;
    sceneDescription: string;
    heraldText: string | null;
    options: NarrativeOption[];
    phaseState: PhaseState | null;
    eternalRan: boolean;
    toolCallCount: number;
    durationMs: number;
}

// ── Saint Engine ───────────────────────────────────────────────────────────

export class SaintEngine {
    private chain: AgentChain;
    private runtimeGatedChains: Array<{
        chain: AgentChain;
        gate: (state: NarrativeState) => boolean;
    }>;

    // Agent instances (injected by builder)
    private agents: Map<string, AgenticAgent> = new Map();

    // Shared utilities (injected by builder)
    private extractOptions: (result: AgentResult) => NarrativeOption[];
    private readPhaseState: (sessionId: string) => Promise<PhaseState>;
    private buildTremorPrompt: (input: TurnInput, focus?: string) => string;
    private buildWitnessPrompt: (input: TurnInput, focus?: string) => Promise<string>;
    private buildProsePrompt: (
        input: TurnInput,
        witnessText: string,
        options: NarrativeOption[],
        phaseState: PhaseState | null
    ) => string;
    private buildEternalPrompt: (signal: { text: string; significance: number }) => string;
    private buildHeraldPrompt: (signal: { text: string; significance: number }) => string;
    private cleanProseResult: (text: string) => string;
    private persistBeat: (
        input: TurnInput,
        options: NarrativeOption[],
        sceneDescription: string
    ) => Promise<unknown>;
    private runNpcAgents: (
        sessionId: string,
        ids: string[]
    ) => Promise<NpcBatchResult>;
    private checkHeraldLog: (sessionId: string) => Promise<boolean>;
    private logHeraldSpoke: (sessionId: string, text: string) => Promise<void>;

    private constructor(
        private config: EngineConfig,
        deps: {
            agents: Map<string, AgenticAgent>;
            extractOptions: SaintEngine["extractOptions"];
            readPhaseState: SaintEngine["readPhaseState"];
            buildTremorPrompt: SaintEngine["buildTremorPrompt"];
            buildWitnessPrompt: SaintEngine["buildWitnessPrompt"];
            buildProsePrompt: SaintEngine["buildProsePrompt"];
            buildEternalPrompt: SaintEngine["buildEternalPrompt"];
            buildHeraldPrompt: SaintEngine["buildHeraldPrompt"];
            cleanProseResult: SaintEngine["cleanProseResult"];
            persistBeat: SaintEngine["persistBeat"];
            runNpcAgents: SaintEngine["runNpcAgents"];
            checkHeraldLog: SaintEngine["checkHeraldLog"];
            logHeraldSpoke: SaintEngine["logHeraldSpoke"];
        }
    ) {
        this.agents = deps.agents;
        this.extractOptions = deps.extractOptions;
        this.readPhaseState = deps.readPhaseState;
        this.buildTremorPrompt = deps.buildTremorPrompt;
        this.buildWitnessPrompt = deps.buildWitnessPrompt;
        this.buildProsePrompt = deps.buildProsePrompt;
        this.buildEternalPrompt = deps.buildEternalPrompt;
        this.buildHeraldPrompt = deps.buildHeraldPrompt;
        this.cleanProseResult = deps.cleanProseResult;
        this.persistBeat = deps.persistBeat;
        this.runNpcAgents = deps.runNpcAgents;
        this.checkHeraldLog = deps.checkHeraldLog;
        this.logHeraldSpoke = deps.logHeraldSpoke;

        this.chain = this.buildChain();
        this.runtimeGatedChains = (config.runtimeGatedChains ?? []).map(
            ({ links, gate }) => ({
                chain: new AgentChain(links),
                gate,
            })
        );
    }

    // ── Builder entry point ────────────────────────────────────────────

    static builder(): EngineBuilder {
        return new EngineBuilder();
    }

    // ── Build the main chain ───────────────────────────────────────────

    private buildChain(): AgentChain {
        const links: BaseChainLink[] = [];

        // If the builder provided explicit chain links, use those
        if (this.config.chainLinks && this.config.chainLinks.length > 0) {
            links.push(...this.config.chainLinks);
        } else {
            // Default chain construction from config
            links.push(...this.buildDefaultChain());
        }

        return new AgentChain(links);
    }

    private buildDefaultChain(): BaseChainLink[] {
        const links: BaseChainLink[] = [];
        const tremorAgent = this.agents.get("tremor")!;
        const eternalAgent = this.agents.get("eternal")!;
        const witnessAgent = this.agents.get("witness")!;
        const proseAgent = this.agents.get("prose")!;
        const heraldAgent = this.agents.get("herald");

        // ── 1. Tremor (parallel or single) ─────────────────────────────

        if (this.config.tremorBranches && this.config.tremorBranches.length > 0) {
            links.push(new ParallelTremorLink(
                this.config.tremorBranches,
                this.config.tremorFanIn ?? new ConcatenatedFanIn()
            ));
        } else {
            links.push(new TremorLink(
                tremorAgent,
                { maxSteps: this.config.tremorMaxSteps },
                (input) => this.buildTremorPrompt(input)
            ));
        }

        // ── 2. NPC Agents ──────────────────────────────────────────────

        links.push(new NpcAgentsLink(
            this.config.npcAgentIds,
            this.runNpcAgents
        ));

        // ── 3. Herald (conditional) ────────────────────────────────────

        if (heraldAgent) {
            links.push(new HeraldLink(
                heraldAgent,
                {
                    maxSteps: this.config.heraldMaxSteps,
                    significanceThreshold:
                        this.config.heraldSignificanceThreshold ??
                        this.config.eternalThreshold,
                    allowedPhases: this.config.heraldAllowedPhases ?? [
                        "call_to_adventure",
                        "crossing_threshold",
                        "refusal_of_the_call",
                        "meeting_the_mentor",
                    ],
                },
                (signal) => this.buildHeraldPrompt(signal)
            ));
        }

        // ── 4. Eternal ─────────────────────────────────────────────────

        links.push(new EternalLink(
            eternalAgent,
            {
                maxSteps: this.config.eternalMaxSteps,
                significanceThreshold: this.config.eternalThreshold,
            },
            (signal) => this.buildEternalPrompt(signal)
        ));

        // ── 5. Witness (parallel or single) ────────────────────────────

        if (this.config.witnessBranches && this.config.witnessBranches.length > 0) {
            links.push(new ParallelWitnessLink(
                this.config.witnessBranches,
                this.config.witnessFanIn ?? new ConcatenatedFanIn(),
                this.extractOptions,
                this.readPhaseState
            ));
        } else {
            links.push(new WitnessLink(
                witnessAgent,
                { maxSteps: this.config.witnessMaxSteps },
                (input) => this.buildWitnessPrompt(input),
                this.extractOptions,
                this.readPhaseState
            ));
        }

        // ── 6. Prose ───────────────────────────────────────────────────

        links.push(new ProseLink(
            proseAgent,
            (input, witnessText, options, phaseState) =>
                this.buildProsePrompt(input, witnessText, options, phaseState),
            this.cleanProseResult
        ));

        return links;
    }

    // ── Run turn ───────────────────────────────────────────────────────

    async runTurn(input: TurnInput): Promise<TurnResult> {
        const start = Date.now();

        // Load state
        const state = await this.loadNarrativeState(input.sessionId);
        const player = await this.loadPlayerSession(input.sessionId);
        const heraldAlreadySpoke = await this.checkHeraldLog(input.sessionId);

        // Build context
        const ctx: ChainContext = {
            input,
            state,
            player,
            mutations: [],
            tremorResult: null,
            eternalSignal: null,
            eternalResult: null,
            npcResults: null,
            witnessResult: null,
            proseResult: null,
            heraldText: null,
            phaseState: null,
            toolCallCount: 0,
            options: [],
            metadata: { heraldAlreadySpoke },
            onProgress: input.onProgress,
        };

        // Execute main chain
        await this.chain.execute(ctx);

        // Execute runtime-gated chains
        for (const { chain, gate } of this.runtimeGatedChains) {
            if (!gate(ctx.state)) continue;
            await chain.execute(ctx);
            if (ctx.metadata.chainTerminatedBy) break;
        }

        // Apply mutations
        await this.applyMutations(ctx.mutations, input.sessionId);

        // Persist
        const cleanSceneDescription =
            (ctx.metadata.cleanSceneDescription as string) ?? "";
        const beat = await this.persistBeat(
            input, ctx.options, cleanSceneDescription
        );

        // Log herald
        if (ctx.metadata.heraldSpokeThisTurn) {
            await this.logHeraldSpoke(input.sessionId, ctx.heraldText!);
        }

        input.onProgress?.({ phase: "complete", message: "" });

        return {
            beat,
            sceneDescription: cleanSceneDescription,
            heraldText: ctx.heraldText,
            options: ctx.options,
            phaseState: ctx.phaseState,
            eternalRan: ctx.metadata.eternalRan ?? false,
            toolCallCount: ctx.toolCallCount,
            durationMs: Date.now() - start,
        };
    }

    // ── Private helpers ────────────────────────────────────────────────

    private async loadNarrativeState(
        sessionId: string
    ): Promise<NarrativeState> {
        // Your existing DB load logic
        throw new Error("Implement loadNarrativeState");
    }

    private async loadPlayerSession(
        sessionId: string
    ): Promise<ChainContext["player"]> {
        // Your existing DB load logic
        throw new Error("Implement loadPlayerSession");
    }

    private async applyMutations(
        mutations: ChainContext["mutations"],
        sessionId: string
    ): Promise<void> {
        // Group mutations by type and apply atomically
        const grouped = new Map<string, Record<string, unknown>>();

        for (const m of mutations) {
            if (!grouped.has(m.type)) grouped.set(m.type, {});
            grouped.get(m.type)![m.field] = m.value;
        }

        for (const [type, fields] of grouped) {
            console.log(
                `[Mutation] ${type}: ${JSON.stringify(fields)} ` +
                `(${mutations.filter(m => m.type === type).length} mutations)`
            );
            // await db.query(`UPDATE ${type} SET ... WHERE session_id = $sid`, { sid: sessionId, ...fields });
        }
    }
}

// ── Engine builder ─────────────────────────────────────────────────────────

export class EngineBuilder {
    private config: Partial<EngineConfig> = {};
    private agents: Map<string, AgenticAgent> = new Map();
    private chainLinks: BaseChainLink[] = [];
    private runtimeGatedChains: Array<{
        links: BaseChainLink[];
        gate: (state: NarrativeState) => boolean;
    }> = [];

    // Dependency injection
    private deps: Partial<{
        extractOptions: SaintEngine["extractOptions"];
        readPhaseState: SaintEngine["readPhaseState"];
        buildTremorPrompt: SaintEngine["buildTremorPrompt"];
        buildWitnessPrompt: SaintEngine["buildWitnessPrompt"];
        buildProsePrompt: SaintEngine["buildProsePrompt"];
        buildEternalPrompt: SaintEngine["buildEternalPrompt"];
        buildHeraldPrompt: SaintEngine["buildHeraldPrompt"];
        cleanProseResult: SaintEngine["cleanProseResult"];
        persistBeat: SaintEngine["persistBeat"];
        runNpcAgents: SaintEngine["runNpcAgents"];
        checkHeraldLog: SaintEngine["checkHeraldLog"];
        logHeraldSpoke: SaintEngine["logHeraldSpoke"];
    }> = {};

    // ── Config methods ─────────────────────────────────────────────────

    powerModel(model: string): this {
        this.config.powerModel = model;
        return this;
    }

    fastModel(model: string): this {
        this.config.fastModel = model;
        return this;
    }

    genre(tone: string): this {
        this.config.genre = tone;
        return this;
    }

    eternalThreshold(n: number): this {
        this.config.eternalThreshold = n;
        return this;
    }

    maxSteps(tremor: number, witness: number, eternal: number): this {
        this.config.tremorMaxSteps = tremor;
        this.config.witnessMaxSteps = witness;
        this.config.eternalMaxSteps = eternal;
        return this;
    }

    phaseThresholds(t: Record<string, number>): this {
        this.config.phaseThresholds = t;
        return this;
    }

    npcAgentIds(ids: string[]): this {
        this.config.npcAgentIds = ids;
        return this;
    }

    // ── Agent registration ─────────────────────────────────────────────

    withAgent(name: string, agent: AgenticAgent): this {
        this.agents.set(name, agent);
        return this;
    }

    // ── Chain link registration ────────────────────────────────────────

    withLink(link: BaseChainLink): this {
        this.chainLinks.push(link);
        return this;
    }

    // ── Conditional chain composition ──────────────────────────────────
    //
    //  builder.when("horror", links => links
    //      .link(new DreadEscalatorLink())
    //      .link(new SanityDrainLink())
    //      .link(new BreakingPointLink())
    //  )

    when(
        condition: string | string[] | ((config: Partial<EngineConfig>) => boolean),
        configure: (sub: ChainSubBuilder) => void
    ): this {
        const predicate = this.resolvePredicate(condition);
        if (predicate(this.config)) {
            const sub = new ChainSubBuilder();
            configure(sub);
            this.chainLinks.push(...sub.getLinks());
        }
        return this;
    }

    // ── Runtime-gated chain ────────────────────────────────────────────

    whenRuntime(
        gate: (state: NarrativeState) => boolean,
        configure: (sub: ChainSubBuilder) => void
    ): this {
        const sub = new ChainSubBuilder();
        configure(sub);
        this.runtimeGatedChains.push({ links: sub.getLinks(), gate });
        return this;
    }

    // ── Parallel tremor configuration ──────────────────────────────────

    withParallelTremor(
        branches: ParallelBranch[],
        fanIn?: FanInStrategy
    ): this {
        this.config.tremorBranches = branches;
        this.config.tremorFanIn = fanIn;
        return this;
    }

    // ── Parallel witness configuration ─────────────────────────────────

    withParallelWitness(
        branches: ParallelBranch[],
        fanIn?: FanInStrategy
    ): this {
        this.config.witnessBranches = branches;
        this.config.witnessFanIn = fanIn;
        return this;
    }

    // ── Herald configuration ───────────────────────────────────────────

    withHerald(config: {
        significanceThreshold?: number;
        allowedPhases?: string[];
        maxSteps?: number;
    }): this {
        this.config.heraldSignificanceThreshold = config.significanceThreshold;
        this.config.heraldAllowedPhases = config.allowedPhases;
        if (config.maxSteps) this.config.heraldMaxSteps = config.maxSteps;
        return this;
    }

    // ── Dependency injection ───────────────────────────────────────────

    withExtractOptions(fn: SaintEngine["extractOptions"]): this {
        this.deps.extractOptions = fn;
        return this;
    }

    withReadPhaseState(fn: SaintEngine["readPhaseState"]): this {
        this.deps.readPhaseState = fn;
        return this;
    }

    withBuildTremorPrompt(fn: SaintEngine["buildTremorPrompt"]): this {
        this.deps.buildTremorPrompt = fn;
        return this;
    }

    withBuildWitnessPrompt(fn: SaintEngine["buildWitnessPrompt"]): this {
        this.deps.buildWitnessPrompt = fn;
        return this;
    }

    withBuildProsePrompt(fn: SaintEngine["buildProsePrompt"]): this {
        this.deps.buildProsePrompt = fn;
        return this;
    }

    withBuildEternalPrompt(fn: SaintEngine["buildEternalPrompt"]): this {
        this.deps.buildEternalPrompt = fn;
        return this;
    }

    withBuildHeraldPrompt(fn: SaintEngine["buildHeraldPrompt"]): this {
        this.deps.buildHeraldPrompt = fn;
        return this;
    }

    withCleanProseResult(fn: SaintEngine["cleanProseResult"]): this {
        this.deps.cleanProseResult = fn;
        return this;
    }

    withPersistBeat(fn: SaintEngine["persistBeat"]): this {
        this.deps.persistBeat = fn;
        return this;
    }

    withRunNpcAgents(fn: SaintEngine["runNpcAgents"]): this {
        this.deps.runNpcAgents = fn;
        return this;
    }

    withCheckHeraldLog(fn: SaintEngine["checkHeraldLog"]): this {
        this.deps.checkHeraldLog = fn;
        return this;
    }

    withLogHeraldSpoke(fn: SaintEngine["logHeraldSpoke"]): this {
        this.deps.logHeraldSpoke = fn;
        return this;
    }

    // ── Build ──────────────────────────────────────────────────────────

    build(): SaintEngine {
        // Validate required fields
        const required: Array<keyof EngineConfig> = [
            "powerModel", "fastModel", "genre", "eternalThreshold",
        ];
        for (const key of required) {
            if (!(key in this.config)) {
                throw new Error(`EngineBuilder: missing required config "${key}"`);
            }
        }

        // Set defaults
        this.config.tremorMaxSteps ??= 12;
        this.config.eternalMaxSteps ??= 12;
        this.config.witnessMaxSteps ??= 12;
        this.config.heraldMaxSteps ??= 8;
        this.config.proseMaxSteps ??= 8;
        this.config.npcAgentIds ??= [];
        this.config.maxSteps ??= [12, 12, 12];
        this.config.phaseThresholds ??= {};

        // If explicit chain links were provided, attach them
        if (this.chainLinks.length > 0) {
            this.config.chainLinks = this.chainLinks;
        }

        this.config.runtimeGatedChains = this.runtimeGatedChains;

        return new SaintEngine(
            this.config as EngineConfig,
            {
                agents: this.agents,
                extractOptions: this.deps.extractOptions!,
                readPhaseState: this.deps.readPhaseState!,
                buildTremorPrompt: this.deps.buildTremorPrompt!,
                buildWitnessPrompt: this.deps.buildWitnessPrompt!,
                buildProsePrompt: this.deps.buildProsePrompt!,
                buildEternalPrompt: this.deps.buildEternalPrompt!,
                buildHeraldPrompt: this.deps.buildHeraldPrompt!,
                cleanProseResult: this.deps.cleanProseResult!,
                persistBeat: this.deps.persistBeat!,
                runNpcAgents: this.deps.runNpcAgents!,
                checkHeraldLog: this.deps.checkHeraldLog!,
                logHeraldSpoke: this.deps.logHeraldSpoke!,
            }
        );
    }

    // ── Private ────────────────────────────────────────────────────────

    private resolvePredicate(
        condition: string | string[] | ((config: Partial<EngineConfig>) => boolean)
    ): (config: Partial<EngineConfig>) => boolean {
        if (typeof condition === "function") return condition;
        const genres = Array.isArray(condition) ? condition : [condition];
        return (config) => genres.includes(config.genre!);
    }
}

// ── Chain sub-builder ──────────────────────────────────────────────────────

export class ChainSubBuilder {
    private links: BaseChainLink[] = [];

    link(chainLink: BaseChainLink): this {
        this.links.push(chainLink);
        return this;
    }

    getLinks(): BaseChainLink[] {
        return this.links;
    }
}
```

## File Refactor 2 — src/lib/session-engine.ts

Update buildEngineForGame to use the new builder API.


What changes

1.buildEngineForGame returns SaintEngine via SaintEngine.builder()
2.Genre-specific chains are configured with .when()
3.Parallel tremor/witness branches are configured with .withParallelTremor() / .withParallelWitness()
4.Herald is configured with .withHerald()
5.Runtime-gated chains use .whenRuntime()
6.Agent instances and dependency functions are injected via .withAgent() / .withXxx()

Refactored buildEngineForGame

```typescript

// src/lib/session-engine.ts
// Only the buildEngineForGame function changes. Everything else stays the same.

import { SaintEngine } from "../agentic/game/saint-engine";
import {
    ParallelTremorLink,
    ParallelWitnessLink,
    PriorityMergeFanIn,
    ConcatenatedFanIn,
    DreadEscalatorLink,         // your genre-specific links
    SanityDrainLink,
    BreakingPointLink,
    TensionRatchetLink,
    RedHerringLink,
    RevealLink,
    DecayTrackerLink,
    FamilySecretLink,
    ReckoningLink,
    WorldScaleLink,
    FactionDynamicsLink,
    EntropyCollapseLink,
    MentorInterventionLink,
    // etc.
} from "../agentic/game/chain";

export function buildEngineForGame(game: GameRecord): SaintEngine {
    const tone = resolveGenreTone(game.genre);
    const models = resolveModels(game.cost_tier);
    const thresholds = resolvePhaseThresholds(tone);
    const eternal = resolveEternalThreshold(tone);

    return SaintEngine
        .builder()

        // ── Config ─────────────────────────────────────────────────────

        .powerModel(models.power)
        .fastModel(models.fast)
        .genre(tone)
        .eternalThreshold(eternal)
        .maxSteps(12, 12, 12)
        .phaseThresholds(thresholds)
        .npcAgentIds(game.npc_agent_ids ?? [])

        // ── Agents (your actual agent instances) ───────────────────────

        .withAgent("tremor", createTremorAgent(models.fast))
        .withAgent("eternal", createEternalAgent(models.power))
        .withAgent("witness", createWitnessAgent(models.power))
        .withAgent("prose", createProseAgent(models.power))
        .withAgent("herald", createHeraldAgent(models.power))
        .withAgent("merge", createMergeAgent(models.fast))

        // ── Parallel tremor (4 agents × 4 tools) ──────────────────────

        .withParallelTremor(
            [
                {
                    name: "tremor_world",
                    agent: createTremorAgent(models.fast),
                    tools: [
                        "query_world_state",
                        "check_faction_standing",
                        "evaluate_location_risk",
                        "scan_environmental_hazards",
                    ],
                    promptBuilder: (ctx) => buildTremorPrompt(ctx.input, "world"),
                    maxSteps: 12,
                },
                {
                    name: "tremor_social",
                    agent: createTremorAgent(models.fast),
                    tools: [
                        "query_npc_relations",
                        "check_reputation",
                        "evaluate_social_tension",
                        "scan_power_dynamics",
                    ],
                    promptBuilder: (ctx) => buildTremorPrompt(ctx.input, "social"),
                    maxSteps: 12,
                },
                {
                    name: "tremor_narrative",
                    agent: createTremorAgent(models.fast),
                    tools: [
                        "query_active_threads",
                        "check_plot_hooks",
                        "evaluate_pacing",
                        "scan_unresolved_conflicts",
                    ],
                    promptBuilder: (ctx) => buildTremorPrompt(ctx.input, "narrative"),
                    maxSteps: 12,
                },
                {
                    name: "tremor_impact",
                    agent: createTremorAgent(models.fast),
                    tools: [
                        "query_player_vectors",
                        "check_moral_drift",
                        "evaluate_consequence_weight",
                        "scan_breaking_points",
                    ],
                    promptBuilder: (ctx) => buildTremorPrompt(ctx.input, "impact"),
                    maxSteps: 12,
                    critical: true, // if impact branch fails, abort
                },
            ],
            new PriorityMergeFanIn([
                "tremor_impact",
                "tremor_narrative",
                "tremor_social",
                "tremor_world",
            ])
        )

        // ── Parallel witness (4 agents × 4 tools) ─────────────────────

        .withParallelWitness(
            [
                {
                    name: "witness_narrative",
                    agent: createWitnessAgent(models.power),
                    tools: [
                        "generate_scene_direction",
                        "evaluate_dramatic_potential",
                        "check_narrative_coherence",
                        "propose_plot_advancement",
                    ],
                    promptBuilder: (ctx) => buildWitnessPrompt(ctx.input, "narrative"),
                    maxSteps: 12,
                },
                {
                    name: "witness_character",
                    agent: createWitnessAgent(models.power),
                    tools: [
                        "generate_character_moments",
                        "evaluate_emotional_beats",
                        "check_motivation_alignment",
                        "propose_dialogue_direction",
                    ],
                    promptBuilder: (ctx) => buildWitnessPrompt(ctx.input, "character"),
                    maxSteps: 12,
                },
                {
                    name: "witness_choice",
                    agent: createWitnessAgent(models.power),
                    tools: [
                        "generate_choice_options",
                        "evaluate_choice_consequences",
                        "check_moral_weight",
                        "propose_hidden_options",
                    ],
                    promptBuilder: (ctx) => buildWitnessPrompt(ctx.input, "choice"),
                    maxSteps: 12,
                },
                {
                    name: "witness_world",
                    agent: createWitnessAgent(models.power),
                    tools: [
                        "generate_world_reactions",
                        "evaluate_faction_responses",
                        "check_environmental_changes",
                        "propose_world_events",
                    ],
                    promptBuilder: (ctx) => buildWitnessPrompt(ctx.input, "world"),
                    maxSteps: 12,
                },
            ],
            new AgenticMergeFanIn(createMergeAgent(models.fast))
        )

        // ── Herald ─────────────────────────────────────────────────────

        .withHerald({
            significanceThreshold: eternal,
            allowedPhases: [
                "call_to_adventure",
                "crossing_threshold",
                "refusal_of_the_call",
                "meeting_the_mentor",
            ],
            maxSteps: 8,
        })

        // ── Genre-specific chains (build-time condition) ───────────────

        .when("horror", chain => chain
            .link(new DreadEscalatorLink())
            .link(new SanityDrainLink())
            .link(new BreakingPointLink())
        )

        .when("thriller", chain => chain
            .link(new TensionRatchetLink())
            .link(new RedHerringLink())
            .link(new RevealLink())
        )

        .when("southern_gothic", chain => chain
            .link(new DecayTrackerLink())
            .link(new FamilySecretLink())
            .link(new ReckoningLink())
        )

        .when(["fantasy", "science_fiction"], chain => chain
            .link(new WorldScaleLink())
            .link(new FactionDynamicsLink())
        )

        // ── Runtime-gated chains (checked every turn) ──────────────────

        .whenRuntime(
            state => state.narrative_entropy > 0.6,
            chain => chain
                .link(new EntropyCollapseLink())
        )

        .whenRuntime(
            state =>
                state.current_phase === "ordeal" &&
                state.player_resonance < 0.2,
            chain => chain
                .link(new MentorInterventionLink())
        )

        // ── Dependency injection ───────────────────────────────────────

        .withExtractOptions(extractOptions)
        .withReadPhaseState(readPhaseState)
        .withBuildTremorPrompt(buildTremorPrompt)
        .withBuildWitnessPrompt(buildWitnessPrompt)
        .withBuildProsePrompt(buildProsePrompt)
        .withBuildEternalPrompt(buildEternalPrompt)
        .withBuildHeraldPrompt(buildHeraldPrompt)
        .withCleanProseResult(cleanProseResult)
        .withPersistBeat(persistBeat)
        .withRunNpcAgents(runNpcAgents)
        .withCheckHeraldLog(checkHeraldLog)
        .withLogHeraldSpoke(logHeraldSpoke)

        // ── Build ──────────────────────────────────────────────────────

        .build();
}
```