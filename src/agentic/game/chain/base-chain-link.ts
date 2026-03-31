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
