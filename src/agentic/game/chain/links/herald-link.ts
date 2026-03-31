// src/agentic/game/chain/links/herald-link.ts
//
// Herald fires FIRST (priority 5) — before Tremor, before anything.
// Conditional on narrative phase and a turn cooldown so it doesn't
// fire every turn. No dependency on eternalSignal.
//
// Receives the GameRecord directly — no DB lookup needed inside the link.
//
// Condition logic in canHandle():
//   1. current_phase must be in allowedPhases (if configured)
//   2. Enough turns must have passed since the last herald appearance
//      (cooldownTurns, default 3)

import { BaseChainLink } from "../base-chain-link";
import { ChainAction, ChainContext } from "../types";
import { generateHeraldContext } from "../../herald-agent";
import type { GameRecord } from "../../../../libs/types";

// ── Herald config ──────────────────────────────────────────────────────────

export interface HeraldConfig {
    /** Minimum turns between Herald appearances. Default: 3. */
    cooldownTurns: number;

    /**
     * Phases during which the Herald is allowed to speak.
     * Empty array = allowed in ALL phases.
     */
    allowedPhases: string[];
}

// ── Herald link ────────────────────────────────────────────────────────────

export class HeraldLink extends BaseChainLink {
    readonly name = "herald";
    readonly priority = 5;   // fires before everything

    constructor(
        // Receive the full GameRecord — no DB lookup needed inside the link
        private game: GameRecord,
        private config: HeraldConfig,
    ) {
        super();
    }

    /**
     * Cheap gate: always consider the herald.
     * The real conditions are in canHandle.
     */
    shouldConsider(_ctx: ChainContext): boolean {
        return true;
    }

    /**
     * Full evaluation. Two conditions must pass:
     *   1. current_phase is in allowedPhases (or allowedPhases is empty → any phase)
     *   2. enough turns have elapsed since the last herald appearance
     */
    canHandle(ctx: ChainContext): ChainAction {
        const currentPhase = ctx.state?.current_phase;

        // Condition 1: phase gate (skip check if allowedPhases is empty)
        if (this.config.allowedPhases.length > 0 && currentPhase) {
            if (!this.config.allowedPhases.includes(currentPhase)) {
                console.log(
                    `[Herald] phase "${currentPhase}" not in allowedPhases — skipping`
                );
                return ChainAction.SKIPPED;
            }
        }

        // Condition 2: cooldown gate
        const lastHeraldTurn = (ctx.metadata.lastHeraldTurn as number) ?? 0;
        const turnsSinceLast = ctx.input.turnNumber - lastHeraldTurn;

        if (ctx.input.turnNumber > 0 && turnsSinceLast < this.config.cooldownTurns) {
            console.log(
                `[Herald] cooldown active — ${turnsSinceLast}/${this.config.cooldownTurns} turns elapsed — skipping`
            );
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
        ctx.onProgress?.({ phase: "herald", message: "The Herald speaks..." });

        try {
            const heraldResult = await generateHeraldContext(
                this.game,
                ctx.input.sessionId,
                ctx.input.turnNumber,
                (ctx.input as any).chosenOptionText || undefined
            );

            ctx.heraldText = heraldResult.heraldText;
            ctx.metadata.lastHeraldTurn = ctx.input.turnNumber;
            ctx.metadata.heraldSpokeThisTurn = true;

            console.log("[===Herald===] Herald text:", ctx.heraldText);

            // Emit herald text as a progress event so the client
            // can display it while other agents run
            ctx.onProgress?.({ phase: "herald", message: ctx.heraldText });

        } catch (err) {
            console.error("[===Herald===] Error generating herald context:", err);
            // Herald failed — other agents still run
            ctx.heraldText = null;
        }
    }
}
