// src/agentic/shared/types/chain-types.ts
//
// Chain-system-specific types that do NOT already exist in libs/types.ts.
//
// Types that DO exist in libs/types.ts are imported and re-exported here
// under their chain-system alias to keep the chain files clean.
//
// DO NOT add: NarrativeOption, TurnInput, NarrativePhaseState,
// PlayerInfluenceVectors, NarrativeBeat — those live in libs/types.ts.

import type {
    NarrativeOption,
    NarrativePhaseState,
    PlayerInfluenceVectors,
    TurnInput,
} from "../../../libs/types";

// ── Re-exports from libs/types (alias into chain naming) ──────────────────

export type { NarrativeOption, TurnInput };

/** Alias: NarrativeState is the same record as NarrativePhaseState in the DB */
export type NarrativeState = NarrativePhaseState;

/** Alias: PhaseState is the same record as NarrativePhaseState in the DB */
export type PhaseState = NarrativePhaseState;

/** Alias: PlayerSession maps to PlayerInfluenceVectors */
export type PlayerSession = PlayerInfluenceVectors;

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

// ── Eternal signal (extracted from Tremor output) ──────────────────────────

export interface EternalSignal {
    text: string;
    significance: number;
    source?: string;
}

// ── Agent result (wrapper around whatever the Mastra agent library returns) ─

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

// ── Tool result (for parallel branch accumulation) ─────────────────────────

export interface ToolResult {
    toolName: string;
    result: unknown;
}

// ── Parallel branch ────────────────────────────────────────────────────────

export interface ParallelBranch {
    name: string;
    agent: AgenticAgent;
    tools: string[];               // which tools this branch has access to
    promptBuilder: (ctx: ChainContext) => string | Promise<string>;
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

// ── NpcBatchResult (from npc runner) ──────────────────────────────────────

export interface NpcBatchResult {
    results: AgentResult[];
    totalToolCalls: number;
}

// ── AgenticAgent (interface the agent library must satisfy) ────────────────

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

// ── Runtime gate (for runtime-conditional chains) ──────────────────────────

export type RuntimeGate = (state: NarrativeState) => boolean;
