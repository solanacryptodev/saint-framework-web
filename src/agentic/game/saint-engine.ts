"use server";

// src/agentic/game/saint-engine.ts
//
// The SAINT Engine — the game loop superclass.
//
// Architecture: AgentChain-based turn pipeline.
// Links run in priority order:
//   5  — Herald        (conditional: phase + cooldown)
//   10 — Tremor        (world mutation)
//   20 — NPC Agents    (optional, parallel)
//   30 — Eternal       (conditional: significance threshold)
//   40 — Witness       (narrative assembly)
//   50 — Prose         (scene generation)
//
// The engine is built via EngineBuilder (builder pattern).
// Agent instances are injected from the agents/ directory.
// All prompt builders, helpers, and persist logic are injected as deps.

import { getDB } from "../../libs/surreal";
import { Table } from "surrealdb";
import type {
    NarrativeOption,
    NarrativeBeat,
    NarrativePhaseState,
    TurnInput,
    TurnOutput,
    EngineConfig,
    PlayerInfluenceVectors,
    GameRecord,
} from "../../libs/types";
import {
    AgentChain,
    BaseChainLink,
    ChainContext,
    NarrativeState,
    PhaseState,
    AgentResult,
    AgenticAgent,
    NpcBatchResult,
    ParallelBranch,
    FanInStrategy,
    TremorLink,
    ParallelTremorLink,
    NpcAgentsLink,
    HeraldLink,
    HeraldConfig,
    EternalLink,
    WitnessLink,
    ParallelWitnessLink,
    ProseLink,
    ConcatenatedFanIn,
} from "./chain";
import type { TurnProgress } from "../../libs/types";

// ═══════════════════════════════════════════════════════════════════════════
// SAINT ENGINE
// ═══════════════════════════════════════════════════════════════════════════

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
    private readPhaseState: (sessionId: string) => Promise<NarrativePhaseState>;
    private buildTremorPrompt: (input: TurnInput) => string;
    private buildWitnessPrompt: (input: TurnInput) => Promise<string>;
    private buildProsePrompt: (
        input: TurnInput,
        witnessText: string,
        options: NarrativeOption[],
        phaseState: NarrativePhaseState | null
    ) => string;
    private buildEternalPrompt: (signal: { text: string; significance: number }) => string;
    private cleanProseResult: (text: string) => string;
    private persistBeat: (
        input: TurnInput,
        options: NarrativeOption[],
        sceneDescription: string
    ) => Promise<NarrativeBeat>;
    private runNpcAgents: (
        sessionId: string,
        ids: string[]
    ) => Promise<NpcBatchResult>;

    private engineConfig: EngineConfig;
    private heraldConfig: { game: GameRecord; cooldownTurns: number; allowedPhases: string[] };

    private constructor(
        config: EngineConfig,
        heraldCfg: { game: GameRecord; cooldownTurns: number; allowedPhases: string[] },
        agents: Map<string, AgenticAgent>,
        deps: {
            extractOptions: SaintEngine["extractOptions"];
            readPhaseState: SaintEngine["readPhaseState"];
            buildTremorPrompt: SaintEngine["buildTremorPrompt"];
            buildWitnessPrompt: SaintEngine["buildWitnessPrompt"];
            buildProsePrompt: SaintEngine["buildProsePrompt"];
            buildEternalPrompt: SaintEngine["buildEternalPrompt"];
            cleanProseResult: SaintEngine["cleanProseResult"];
            persistBeat: SaintEngine["persistBeat"];
            runNpcAgents: SaintEngine["runNpcAgents"];
        },
        runtimeGatedChains: Array<{
            links: BaseChainLink[];
            gate: (state: NarrativeState) => boolean;
        }>
    ) {
        this.engineConfig = config;
        this.heraldConfig = heraldCfg;
        this.agents = agents;
        this.extractOptions = deps.extractOptions;
        this.readPhaseState = deps.readPhaseState;
        this.buildTremorPrompt = deps.buildTremorPrompt;
        this.buildWitnessPrompt = deps.buildWitnessPrompt;
        this.buildProsePrompt = deps.buildProsePrompt;
        this.buildEternalPrompt = deps.buildEternalPrompt;
        this.cleanProseResult = deps.cleanProseResult;
        this.persistBeat = deps.persistBeat;
        this.runNpcAgents = deps.runNpcAgents;

        this.chain = this.buildChain();
        this.runtimeGatedChains = runtimeGatedChains.map(
            ({ links, gate }) => ({
                chain: new AgentChain(links),
                gate,
            })
        );
    }

    // ── Builder entry point ────────────────────────────────────────────

    static builder(): SaintEngineBuilder {
        return new SaintEngineBuilder();
    }

    // ── Build the main chain ───────────────────────────────────────────

    private buildChain(): AgentChain {
        const links: BaseChainLink[] = [];
        const cfg = this.engineConfig;

        const tremorAgent = this.agents.get("tremor")!;
        const eternalAgent = this.agents.get("eternal")!;
        const witnessAgent = this.agents.get("witness")!;
        const proseAgent = this.agents.get("prose")!;

        // ── Link 5: Herald (conditional: phase + cooldown) ─────────────
        links.push(new HeraldLink(
            this.heraldConfig.game,
            {
                cooldownTurns: this.heraldConfig.cooldownTurns,
                allowedPhases: this.heraldConfig.allowedPhases,
            }
        ));

        // ── Link 10: Tremor (parallel or single) ───────────────────────
        if (cfg.tremorBranches && cfg.tremorBranches.length > 0) {
            links.push(new ParallelTremorLink(
                cfg.tremorBranches as ParallelBranch[],
                (cfg.tremorFanIn as FanInStrategy) ?? new ConcatenatedFanIn()
            ));
        } else {
            links.push(new TremorLink(
                tremorAgent,
                { maxSteps: cfg.tremorMaxSteps },
                (input) => this.buildTremorPrompt(input)
            ));
        }

        // ── Link 20: NPC Agents ─────────────────────────────────────────
        links.push(new NpcAgentsLink(
            cfg.npcAgentIds ?? [],
            this.runNpcAgents
        ));

        // ── Link 30: Eternal (conditional on significance) ─────────────
        links.push(new EternalLink(
            eternalAgent,
            {
                maxSteps: cfg.eternalMaxSteps,
                significanceThreshold: cfg.eternalSignificanceThreshold,
            },
            (signal) => this.buildEternalPrompt(signal)
        ));

        // ── Link 40: Witness (parallel or single) ──────────────────────
        if (cfg.witnessBranches && cfg.witnessBranches.length > 0) {
            links.push(new ParallelWitnessLink(
                cfg.witnessBranches as ParallelBranch[],
                (cfg.witnessFanIn as FanInStrategy) ?? new ConcatenatedFanIn(),
                this.extractOptions,
                this.readPhaseState
            ));
        } else {
            links.push(new WitnessLink(
                witnessAgent,
                { maxSteps: cfg.witnessMaxSteps },
                (input) => this.buildWitnessPrompt(input),
                this.extractOptions,
                this.readPhaseState
            ));
        }

        // ── Link 50: Prose ─────────────────────────────────────────────
        links.push(new ProseLink(
            proseAgent,
            (input, witnessText, options, phaseState) =>
                this.buildProsePrompt(input, witnessText, options, phaseState),
            this.cleanProseResult
        ));

        return new AgentChain(links);
    }

    // ── Run turn ───────────────────────────────────────────────────────

    async runTurn(
        input: TurnInput,
        onProgress?: (update: TurnProgress) => void
    ): Promise<TurnOutput> {
        const start = Date.now();

        // Load session state for context
        const state = await this.loadNarrativeState(input.sessionId);
        const player = await this.loadPlayerSession(input.sessionId);

        // Load the turn number of the last herald appearance
        const lastHeraldTurn = await this.loadLastHeraldTurn(input.sessionId);

        // Build chain context
        // Cast onProgress: TurnProgress and ProgressUpdate share the same
        // runtime shape {phase, message}; TurnProgress just narrows the phase union.
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
            options: [],
            toolCallCount: 0,
            metadata: { lastHeraldTurn },
            onProgress: onProgress as ((u: { phase: string; message: string }) => void) | undefined,
        };

        // ── Execute main chain ──────────────────────────────────────────
        await this.chain.execute(ctx);

        // ── Execute runtime-gated chains ────────────────────────────────
        for (const { chain, gate } of this.runtimeGatedChains) {
            if (!gate(ctx.state)) continue;
            await chain.execute(ctx);
            if (ctx.metadata.chainTerminatedBy) break;
        }

        // ── Apply accumulated mutations ─────────────────────────────────
        await this.applyMutations(ctx.mutations, input.sessionId);

        // ── Persist herald turn if it spoke ────────────────────────────
        if (ctx.metadata.heraldSpokeThisTurn) {
            await this.persistHeraldTurn(input.sessionId, input.turnNumber);
        }

        // ── Persist the beat ───────────────────────────────────────────
        const cleanSceneDescription =
            (ctx.metadata.cleanSceneDescription as string) ?? "";
        const beat = await this.persistBeat(input, ctx.options, cleanSceneDescription);
        console.log("===Beat===", beat);

        // Signal completion
        onProgress?.({ phase: "complete", message: "" });

        return {
            beat,
            sceneDescription: cleanSceneDescription,
            heraldText: ctx.heraldText ?? undefined,
            options: ctx.options,
            phaseState: ctx.phaseState ?? await this.loadNarrativeState(input.sessionId),
            eternalRan: (ctx.metadata.eternalRan as boolean) ?? false,
            toolCallCount: ctx.toolCallCount,
            durationMs: Date.now() - start,
        };
    }

    // ── Private helpers ────────────────────────────────────────────────

    private async loadNarrativeState(sessionId: string): Promise<NarrativePhaseState> {
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
            point_of_no_return: 0,
            pull_conflict: 0,
            story_pace: 1.0,
            breaking_point: 0,
            event_distortion: 0,
            world_awareness: 0,
        };
    }

    private async loadPlayerSession(sessionId: string): Promise<PlayerInfluenceVectors> {
        const db = await getDB();
        const [rows] = await db.query<[PlayerInfluenceVectors[]]>(
            `SELECT * FROM player_session WHERE session_id = $sid LIMIT 1`,
            { sid: sessionId }
        );
        return rows?.[0] ?? {
            session_id: sessionId,
            game_id: "",
            player_id: "",
            moral_stance: 0,
            approach: 0,
            scale: 0.5,
            foresight: 0,
            pull_on_world: [0, 0, 0],
            idea_amplification: {},
            stability_effect: 0,
        };
    }

    private async loadLastHeraldTurn(sessionId: string): Promise<number> {
        try {
            const db = await getDB();
            const [rows] = await db.query<[{ last_herald_turn: number }[]]>(
                `SELECT last_herald_turn FROM game_session WHERE session_id = $sid LIMIT 1`,
                { sid: sessionId }
            );
            return rows?.[0]?.last_herald_turn ?? 0;
        } catch {
            return 0;
        }
    }

    private async persistHeraldTurn(sessionId: string, turnNumber: number): Promise<void> {
        try {
            const db = await getDB();
            await db.query(
                `UPDATE game_session SET last_herald_turn = $turn WHERE session_id = $sid`,
                { sid: sessionId, turn: turnNumber }
            );
        } catch (err) {
            console.error("[Herald] Failed to persist herald turn:", err);
        }
    }

    private async applyMutations(
        mutations: ChainContext["mutations"],
        sessionId: string
    ): Promise<void> {
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

    // ── Internal build method (used by builder) ────────────────────────

    static _internalBuild(
        config: EngineConfig,
        heraldCfg: { game: GameRecord; cooldownTurns: number; allowedPhases: string[] },
        agents: Map<string, AgenticAgent>,
        deps: {
            extractOptions: SaintEngine["extractOptions"];
            readPhaseState: SaintEngine["readPhaseState"];
            buildTremorPrompt: SaintEngine["buildTremorPrompt"];
            buildWitnessPrompt: SaintEngine["buildWitnessPrompt"];
            buildProsePrompt: SaintEngine["buildProsePrompt"];
            buildEternalPrompt: SaintEngine["buildEternalPrompt"];
            cleanProseResult: SaintEngine["cleanProseResult"];
            persistBeat: SaintEngine["persistBeat"];
            runNpcAgents: SaintEngine["runNpcAgents"];
        },
        runtimeGatedChains: Array<{
            links: BaseChainLink[];
            gate: (state: NarrativeState) => boolean;
        }>
    ): SaintEngine {
        return new SaintEngine(config, heraldCfg, agents, deps, runtimeGatedChains);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export class SaintEngineBuilder {
    private config: Partial<EngineConfig> = {};
    private agents: Map<string, AgenticAgent> = new Map();
    private chainLinks: BaseChainLink[] = [];
    private runtimeGatedChains: Array<{
        links: BaseChainLink[];
        gate: (state: NarrativeState) => boolean;
    }> = [];
    private heraldCfg: { game: GameRecord; cooldownTurns: number; allowedPhases: string[] } = {
        game: null as unknown as GameRecord,
        cooldownTurns: 3,
        allowedPhases: [],
    };

    private deps: Partial<{
        extractOptions: SaintEngine["extractOptions"];
        readPhaseState: SaintEngine["readPhaseState"];
        buildTremorPrompt: SaintEngine["buildTremorPrompt"];
        buildWitnessPrompt: SaintEngine["buildWitnessPrompt"];
        buildProsePrompt: SaintEngine["buildProsePrompt"];
        buildEternalPrompt: SaintEngine["buildEternalPrompt"];
        cleanProseResult: SaintEngine["cleanProseResult"];
        persistBeat: SaintEngine["persistBeat"];
        runNpcAgents: SaintEngine["runNpcAgents"];
    }> = {};

    // ── Config ─────────────────────────────────────────────────────────

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

    // ── Agent registration ─────────────────────────────────────────────

    withAgent(name: string, agent: AgenticAgent): this {
        this.agents.set(name, agent);
        return this;
    }

    // ── Herald configuration ───────────────────────────────────────────

    withHerald(cfg: {
        game: GameRecord;
        cooldownTurns?: number;
        allowedPhases?: string[];
    }): this {
        this.heraldCfg = {
            game: cfg.game,
            cooldownTurns: cfg.cooldownTurns ?? 3,
            allowedPhases: cfg.allowedPhases ?? [],
        };
        return this;
    }

    // ── Parallel tremor ────────────────────────────────────────────────

    withParallelTremor(
        branches: ParallelBranch[],
        fanIn?: FanInStrategy
    ): this {
        this.config.tremorBranches = branches;
        this.config.tremorFanIn = fanIn;
        return this;
    }

    // ── Parallel witness ───────────────────────────────────────────────

    withParallelWitness(
        branches: ParallelBranch[],
        fanIn?: FanInStrategy
    ): this {
        this.config.witnessBranches = branches;
        this.config.witnessFanIn = fanIn;
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

    // ── Build ──────────────────────────────────────────────────────────

    build(): SaintEngine {
        // Apply defaults
        const resolved: EngineConfig = {
            powerModel: this.config.powerModel ?? "anthropic/claude-haiku-4-5",
            fastModel: this.config.fastModel ?? "anthropic/claude-haiku-4-5",
            proseModel: this.config.proseModel ?? "anthropic/claude-haiku-4-5",
            genreTone: this.config.genreTone ?? "fantasy",
            eternalSignificanceThreshold: this.config.eternalSignificanceThreshold ?? 0.6,
            tremorMaxSteps: this.config.tremorMaxSteps ?? 12,
            eternalMaxSteps: this.config.eternalMaxSteps ?? 12,
            witnessMaxSteps: this.config.witnessMaxSteps ?? 12,
            phaseThresholds: this.config.phaseThresholds ?? {},
            npcAgentIds: this.config.npcAgentIds ?? [],
            // Pass-through parallel config if set
            tremorBranches: this.config.tremorBranches,
            tremorFanIn: this.config.tremorFanIn,
            witnessBranches: this.config.witnessBranches,
            witnessFanIn: this.config.witnessFanIn,
        };

        return SaintEngine._internalBuild(
            resolved,
            this.heraldCfg,
            this.agents,
            {
                extractOptions: this.deps.extractOptions!,
                readPhaseState: this.deps.readPhaseState!,
                buildTremorPrompt: this.deps.buildTremorPrompt!,
                buildWitnessPrompt: this.deps.buildWitnessPrompt!,
                buildProsePrompt: this.deps.buildProsePrompt!,
                buildEternalPrompt: this.deps.buildEternalPrompt!,
                cleanProseResult: this.deps.cleanProseResult!,
                persistBeat: this.deps.persistBeat!,
                runNpcAgents: this.deps.runNpcAgents!,
            },
            this.runtimeGatedChains
        );
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