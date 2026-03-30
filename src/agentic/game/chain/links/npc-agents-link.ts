// src/agentic/game/chain/links/npc-agents-link.ts
//
// Runs NPC agents after Tremor. Priority 20.
// Skipped automatically if no NPC agent IDs are configured.

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
        console.log("===Tool Call Count===", ctx.toolCallCount);
    }
}
