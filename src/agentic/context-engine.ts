"use server";
// src/mastra/context-engine.ts
// ACE Context Engineering: Curators assemble the context window before each Generator pass
// This is the critical "C" in Agentic Context Engineering

import { getDB } from "../libs/surreal";
import type {
    ACEContext,
    LoreSurface,
    WorldNodeSurface,
    ChoiceRecord,
    OptionTone,
} from "../libs/types";

/**
 * Assemble the full ACE context for a session.
 * Called before every Generator invocation.
 * 
 * The Curator's core job: surface the RIGHT lore and world state
 * so Generators can produce choices that feel coherent and consequential.
 */
export async function assembleACEContext(
    sessionId: string,
    turnNumber: number
): Promise<ACEContext> {
    const db = await getDB();

    // ── 1. Surface relevant Lore nodes ───────────────────────────────────────
    // Pull lore nodes that are "hot" — referenced in recent events or world state
    const [loreRows] = await db.query<[any[]]>(`
    SELECT id, kind, name, description, properties
    FROM lore_node
    ORDER BY updated_at DESC
    LIMIT 8
  `);

    const relevantLore: LoreSurface[] = (loreRows ?? []).map((row: any) => ({
        nodeId: String(row.id),
        kind: row.kind,
        name: row.name,
        summary: row.description ?? "",
        relationContext: undefined,
    }));

    // ── 2. Surface active World state ────────────────────────────────────────
    // Query world_thread (active narrative threads) and the player actor's
    // current location for scene context. These are the correct current tables.
    const [threadRows] = await db.query<[any[]]>(`
    SELECT id, name, description, tension, urgency, consequence_seeds
    FROM world_thread
    WHERE session_id = $sessionId AND active = true
    ORDER BY urgency DESC
    LIMIT 6
  `, { sessionId });

    const [playerRows] = await db.query<[any[]]>(`
    SELECT world_agent.name AS actor_name,
           world_location.name AS location_name,
           world_agent.state AS actor_state
    FROM world_agent
    WHERE kind = 'player' AND active = true
    FETCH location_id AS world_location
    LIMIT 1
  `);

    const activeWorldNodes: WorldNodeSurface[] = (threadRows ?? []).map((row: any) => ({
        nodeId: String(row.id),
        kind: "thread",
        name: row.name,
        activeState: {
            description: row.description,
            tension: row.tension,
            urgency: row.urgency,
            consequence_seeds: row.consequence_seeds,
        },
    }));

    // ── 3. Pull current scene from player location ────────────────────────────
    const playerLocation = playerRows?.[0]?.location_name;
    const currentScene = playerLocation
        ?? activeWorldNodes[0]?.name
        ?? "An unknown location shrouded in possibility";

    // ── 4. Pull recent consequence seeds (planted by Swarm) ──────────────────
    const [consequenceRows] = await db.query<[any[]]>(`
    SELECT content
    FROM narrative_event
    WHERE session_id = $sessionId
      AND event_type = 'outcome'
      AND agent_name CONTAINS 'swarm'
    ORDER BY created_at DESC
    LIMIT 4
  `, { sessionId });

    const recentConsequences: string[] = (consequenceRows ?? []).map((r: any) => r.content);

    // ── 5. Reconstruct player choice history ─────────────────────────────────
    const [choiceRows] = await db.query<[any[]]>(`
    SELECT content, metadata, created_at
    FROM narrative_event
    WHERE session_id = $sessionId AND event_type = 'action'
    ORDER BY created_at DESC
    LIMIT 6
  `, { sessionId });

    const recentChoices: ChoiceRecord[] = (choiceRows ?? []).map((r: any, i: number) => ({
        beatId: r.metadata?.beatId ?? `beat-${i}`,
        turnNumber: r.metadata?.turnNumber ?? (turnNumber - i),
        optionId: r.metadata?.optionId ?? "",
        optionText: r.content ?? "",
        tone: (r.metadata?.tone as OptionTone) ?? "cautious",
        timestamp: r.created_at ?? new Date().toISOString(),
    }));

    // ── 6. Analyze player tone pattern ────────────────────────────────────────
    const playerTonePattern: OptionTone[] = recentChoices.map((c) => c.tone);

    // ── 7. Estimate narrative tension (0-1) ──────────────────────────────────
    // Average the real tension values from world_thread, weighted by urgency.
    // Fall back to heuristic if no threads exist yet.
    const aggressiveCount = playerTonePattern.filter((t) => t === "aggressive" || t === "heroic").length;
    const openThreadCount = activeWorldNodes.length;

    let overallTension: number;
    if (activeWorldNodes.length > 0) {
        const avgTension = activeWorldNodes.reduce((sum, n) =>
            sum + ((n.activeState.tension as number) ?? 0.3), 0
        ) / activeWorldNodes.length;
        const urgencyBoost = activeWorldNodes.some(n => (n.activeState.urgency as number) > 0.7) ? 0.1 : 0;
        overallTension = Math.min(1, avgTension + urgencyBoost + (aggressiveCount * 0.05));
    } else {
        overallTension = Math.min(
            1,
            0.3 + (aggressiveCount * 0.1) + (recentConsequences.length * 0.05)
        );
    }

    return {
        sessionId,
        turnNumber,
        relevantLore,
        currentScene,
        activeWorldNodes,
        recentConsequences,
        recentChoices,
        playerTonePattern,
        overallTension,
        openThreadCount,
    };
}

/**
 * Render the ACE context into a compact prompt string for Generator agents.
 * This is the actual "context window" that gets injected.
 */
export function renderContextPrompt(ctx: ACEContext): string {
    const loreBlock = ctx.relevantLore.length > 0
        ? ctx.relevantLore.map((l) => `  [${l.kind}] ${l.name}: ${l.summary}`).join("\n")
        : "  (No lore established yet — you may introduce new elements)";

    const worldBlock = ctx.activeWorldNodes.length > 0
        ? ctx.activeWorldNodes.map((n) => `  [${n.kind}] ${n.name}: ${JSON.stringify(n.activeState)}`).join("\n")
        : "  (World state is fresh — you are establishing the opening)";

    const choiceBlock = ctx.recentChoices.length > 0
        ? ctx.recentChoices
            .slice(0, 3)
            .map((c) => `  Turn ${c.turnNumber} (${c.tone}): "${c.optionText}"`)
            .join("\n")
        : "  (This is the first turn)";

    const consequenceBlock = ctx.recentConsequences.length > 0
        ? ctx.recentConsequences.map((c) => `  → ${c}`).join("\n")
        : "  (None yet)";

    const tonePattern = ctx.playerTonePattern.length > 0
        ? `[${ctx.playerTonePattern.slice(-5).join(" → ")}]`
        : "[unknown]";

    return `
=== ACE CONTEXT (Turn ${ctx.turnNumber}) ===

CURRENT SCENE: ${ctx.currentScene}
NARRATIVE TENSION: ${(ctx.overallTension * 100).toFixed(0)}%  |  OPEN THREADS: ${ctx.openThreadCount}
PLAYER TONE PATTERN: ${tonePattern}

ACTIVE LORE:
${loreBlock}

WORLD STATE:
${worldBlock}

PLAYER RECENT CHOICES:
${choiceBlock}

CONSEQUENCE SEEDS (planted by Swarm — will bloom soon):
${consequenceBlock}

=== END CONTEXT ===
`.trim();
}
