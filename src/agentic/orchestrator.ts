"use server";

// src/agentic/orchestrator.ts
// ACE (Agentic Context Engineering) loop implementation
//
//  ┌─────────────────────────────────────────────────────────────────┐
//  │  1. CURATORS assemble ACE context from Lore + World Graphs      │
//  │  2. GENERATORS produce 3-4 discrete NarrativeOptions            │
//  │  3. PLAYER selects one option                                   │
//  │  4. Hero Agent validates + routes the choice                    │
//  │  5. WorldImpact is applied to World Graph                       │
//  │  6. SWARM reacts in parallel (consequences, tension, gravity)   │
//  │  7. REFLECTOR captures learnings async                          │
//  │  → Back to step 1 for next turn                                 │
//  └─────────────────────────────────────────────────────────────────┘

import { agentFactory, DEFAULT_AGENT_SEEDS } from "./agent-factory";
import { assembleACEContext, renderContextPrompt } from "./context-engine";
import { applyWorldImpact } from "../libs/surreal";
import {
    createAgentDefinition,
    getAgentDefinitions,
    logNarrativeEvent,
    upsertWorldState
} from "../libs/surreal";
import type {
    NarrativeBeat,
    NarrativeOption,
    WorldImpact,
    SwarmReaction,
    GameSession,
    AgentDefinition,
} from "../libs/types";

// ── Bootstrap ─────────────────────────────────────────────────────────────

export async function bootstrapEngine() {
    const [existing] = await getAgentDefinitions();
    const existingNames = new Set((existing as AgentDefinition[]).map((a) => a.name));

    for (const seed of DEFAULT_AGENT_SEEDS) {
        if (!existingNames.has(seed.name)) {
            await createAgentDefinition(seed);
            console.log(`[Bootstrap] Seeded agent: ${seed.name}`);
        }
    }

    await agentFactory.initMastra();
    console.log("[Bootstrap] ACE Narrative Engine ready. Agents:", agentFactory.listAgents());
}

// ── STEP 1 + 2: Generate Options ──────────────────────────────────────────
// Curators build context → Generators produce player choices

export async function generateOptions(session: GameSession): Promise<NarrativeBeat> {
    const beatId = `beat-${session.sessionId}-${session.turnNumber}`;

    // Curator assembles ACE context
    const aceContext = await assembleACEContext(session.sessionId, session.turnNumber);
    const contextPrompt = renderContextPrompt(aceContext);

    // Generator produces options
    const generator = agentFactory.getAgent("generator-01");
    if (!generator) throw new Error("Generator agent not initialized");

    const genResponse = await generator.generate([
        {
            role: "user",
            content: `
${contextPrompt}

BEAT ID: ${beatId}
SESSION: ${session.sessionId}
TURN: ${session.turnNumber}

Generate exactly 3 narrative options for the player. 
Each option must be a distinct path forward — different tones, different world impacts.
At least one should be a "safe" cautious option, and at least one should carry real risk.

Return ONLY valid JSON in this exact shape:
{
  "sceneDescription": "...",  
  "options": [
    {
      "id": "opt-A",
      "text": "...",
      "tone": "aggressive|diplomatic|cautious|curious|compassionate|deceptive|heroic|cowardly",
      "loreReferences": ["lore_node:..."],
      "worldImpact": {
        "actorDeltas": {},
        "locationDeltas": {},
        "itemDeltas": {},
        "newEdges": [],
        "newThreads": [],
        "consequenceSeeds": ["..."],
        "narrativePressure": 0.0
      },
      "weight": 0.8
    }
  ]
}

Make the scene description vivid and specific. Keep each option text under 20 words.
`.trim(),
        },
    ]);

    // Parse generator output
    let parsed: { sceneDescription: string; options: NarrativeOption[] };
    console.log("Generator response:", genResponse.text);
    try {
        const raw = genResponse.text.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(raw);
    } catch {
        parsed = {
            sceneDescription: genResponse.text.slice(0, 300),
            options: [
                { id: "opt-A", text: "Press forward cautiously", tone: "cautious", loreReferences: [], worldImpact: { actorDeltas: {}, locationDeltas: {}, itemDeltas: {}, newEdges: [], newThreads: [], consequenceSeeds: [], narrativePressure: 0.3 }, weight: 0.7 },
                { id: "opt-B", text: "Investigate the anomaly", tone: "curious", loreReferences: [], worldImpact: { actorDeltas: {}, locationDeltas: {}, itemDeltas: {}, newEdges: [], newThreads: [], consequenceSeeds: [], narrativePressure: 0.5 }, weight: 0.8 },
                { id: "opt-C", text: "Turn back and regroup", tone: "cowardly", loreReferences: [], worldImpact: { actorDeltas: {}, locationDeltas: {}, itemDeltas: {}, newEdges: [], newThreads: [], consequenceSeeds: [], narrativePressure: 0.1 }, weight: 0.4 },
            ],
        };
    }

    // Curator validates the options against lore
    const curator = agentFactory.getAgent("curator-01");
    let curatedOptions = parsed.options;
    if (curator) {
        const curateRes = await curator.generate([
            {
                role: "user",
                content: `
LORE CONTEXT:
${aceContext.relevantLore.map((l) => `${l.name}: ${l.summary}`).join("\n") || "None established yet."}

GENERATED OPTIONS:
${JSON.stringify(parsed.options, null, 2)}

Review these options for lore consistency. 
If any option contradicts established lore, correct it.
If all are consistent, return them unchanged.
Return ONLY the corrected JSON array of options (same shape, no extra text).
`.trim(),
            },
        ]);

        try {
            const curateRaw = curateRes.text.replace(/```json|```/g, "").trim();
            const curateArr = JSON.parse(curateRaw);
            if (Array.isArray(curateArr)) curatedOptions = curateArr;
        } catch {
            // Keep original
        }
    }

    // Store beat in World Graph
    await upsertWorldState(session.sessionId, "checkpoint", `beat-pending-${beatId}`, {
        session_id: session.sessionId,
        beat_id: beatId,
        turn_number: session.turnNumber,
        scene_description: parsed.sceneDescription,
        options: curatedOptions,
        status: "awaiting_choice",
    });

    await logNarrativeEvent({
        session_id: session.sessionId,
        agent_name: "generator-01",
        event_type: "outcome",
        content: `Generated ${curatedOptions.length} options for turn ${session.turnNumber}`,
        metadata: { beatId, optionIds: curatedOptions.map((o) => o.id) },
    });

    return {
        beatId,
        sessionId: session.sessionId,
        turnNumber: session.turnNumber,
        sceneDescription: parsed.sceneDescription,
        activeThreads: aceContext.activeWorldNodes.filter((n) => n.kind === "thread").map((n) => n.name),
        loreContext: aceContext.relevantLore.map((l) => l.name),
        options: curatedOptions,
        generatedBy: "generator-01",
    };
}

// ── STEP 3 + 4 + 5: Player Chooses → World Mutates ────────────────────────

export async function resolveChoice(
    session: GameSession,
    beat: NarrativeBeat,
    chosenOptionId: string
): Promise<ResolvedBeat> {
    const chosen = beat.options.find((o) => o.id === chosenOptionId);
    if (!chosen) throw new Error(`Option ${chosenOptionId} not found in beat ${beat.beatId}`);

    await logNarrativeEvent({
        session_id: session.sessionId,
        agent_name: "player",
        event_type: "action",
        content: chosen.text,
        metadata: { beatId: beat.beatId, optionId: chosen.id, tone: chosen.tone, turnNumber: beat.turnNumber },
    });

    // Hero Agent validates + refines the impact
    const heroAgent = agentFactory.getAgent("hero-agent");
    let finalImpact: WorldImpact = chosen.worldImpact;

    if (heroAgent) {
        const heroRes = await heroAgent.generate([
            {
                role: "user",
                content: `
SESSION: ${session.sessionId}  TURN: ${beat.turnNumber}
PLAYER CHOSE: "${chosen.text}" (tone: ${chosen.tone})
SCENE: ${beat.sceneDescription}

Confirm or refine the WorldImpact below. Adjust narrativePressure and consequenceSeeds as needed.

PROPOSED IMPACT:
${JSON.stringify(chosen.worldImpact, null, 2)}

Return ONLY the final WorldImpact JSON (same shape, no extra text).
`.trim(),
            },
        ]);

        try {
            finalImpact = JSON.parse(heroRes.text.replace(/```json|```/g, "").trim());
        } catch { /* keep proposed */ }
    }

    // Apply to World Graph
    await applyWorldImpact(session.sessionId, beat.beatId, finalImpact);

    await logNarrativeEvent({
        session_id: session.sessionId,
        agent_name: "hero-agent",
        event_type: "decision",
        content: `Applied world impact for: ${chosen.text}`,
        metadata: { beatId: beat.beatId, impact: finalImpact },
    });

    // Swarm reacts in parallel
    const swarmReactions = await runSwarm(session, beat, chosen, finalImpact);

    // Reflector async
    runReflector(session, beat, chosen, swarmReactions).catch(console.warn);

    return {
        beat: { ...beat, chosenOptionId, chosenAt: new Date().toISOString(), appliedImpact: finalImpact, curatedBy: "curator-01", swarmReactions },
        chosenOption: chosen,
        finalImpact,
        swarmReactions,
    };
}

// ── STEP 6: Swarm ─────────────────────────────────────────────────────────

async function runSwarm(
    session: GameSession,
    beat: NarrativeBeat,
    chosen: NarrativeOption,
    impact: WorldImpact
): Promise<SwarmReaction[]> {
    const swarmConfigs: Array<{ name: string; reactionType: SwarmReaction["reactionType"]; focus: string }> = [
        { name: "swarm-agent-01", reactionType: "npc_response", focus: "How do NPCs/factions react to this choice? Be specific about who reacts and how." },
        { name: "swarm-agent-02", reactionType: "consequence", focus: "Plant 1-2 consequences that emerge 2-3 turns from now. Specific and surprising." },
        { name: "swarm-agent-03", reactionType: "tension_shift", focus: "How does this shift narrative tension? What story beat is now being built toward?" },
    ];

    const results = await Promise.allSettled(
        swarmConfigs.map(async ({ name, reactionType, focus }) => {
            const agent = agentFactory.getAgent(name);
            if (!agent) return null;

            const res = await agent.generate([{
                role: "user",
                content: `SESSION: ${session.sessionId} | TURN: ${beat.turnNumber}\nPLAYER ACTION: "${chosen.text}" (${chosen.tone})\nSCENE: ${beat.sceneDescription}\n\nFOCUS: ${focus}\n\nRespond in 1-3 sentences. Specific, not vague.`,
            }]);

            const reaction: SwarmReaction = { agentName: name, reactionType, content: res.text, worldNodeAffected: impact.newThreads?.[0]?.id as string | undefined };

            await logNarrativeEvent({
                session_id: session.sessionId,
                agent_name: name,
                event_type: "outcome",
                content: res.text,
                metadata: { beatId: beat.beatId, reactionType },
            });

            return reaction;
        })
    );

    return results
        .filter((r): r is PromiseFulfilledResult<SwarmReaction | null> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((r): r is SwarmReaction => r !== null);
}

// ── STEP 7: Reflector ─────────────────────────────────────────────────────

async function runReflector(session: GameSession, beat: NarrativeBeat, chosen: NarrativeOption, swarmReactions: SwarmReaction[]) {
    const reflector = agentFactory.getAgent("reflector-01");
    if (!reflector) return;
    await reflector.generate([{
        role: "user",
        content: `SESSION: ${session.sessionId} TURN: ${beat.turnNumber}\nPLAYER (${chosen.tone}): "${chosen.text}"\nSWARM: ${swarmReactions.map(r => r.content).join(" | ")}\n\nReflect: narrative momentum? player preference? new lore to codify?`,
    }]);
}

// ── Dynamic Agent Management ───────────────────────────────────────────────

export async function spawnDynamicAgent(def: AgentDefinition) {
    await createAgentDefinition(def);
    await agentFactory.hydrateAgent(def);
    return def;
}

export async function listActiveAgents() {
    const [defs] = await getAgentDefinitions();
    return defs as AgentDefinition[];
}

export interface ResolvedBeat {
    beat: NarrativeBeat;
    chosenOption: NarrativeOption;
    finalImpact: WorldImpact;
    swarmReactions: SwarmReaction[];
}