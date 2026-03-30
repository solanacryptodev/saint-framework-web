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
