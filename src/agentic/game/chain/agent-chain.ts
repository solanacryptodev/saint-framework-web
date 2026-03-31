// src/agentic/game/chain/agent-chain.ts

import { ChainLink } from "./base-chain-link";
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
