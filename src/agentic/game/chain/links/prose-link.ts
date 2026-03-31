// src/agentic/game/chain/links/prose-link.ts
//
// Prose agent. Always runs last (priority 50).
// No tools — pure generation from witness output.
// Generates the scene description the player reads.

import { BaseChainLink } from "../base-chain-link";
import {
    ChainAction,
    ChainContext,
    AgenticAgent,
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
                ctx.witnessResult!.text + (ctx.metadata.sceneAtmosphere ? `\n\n${ctx.metadata.sceneAtmosphere}` : ""),
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
