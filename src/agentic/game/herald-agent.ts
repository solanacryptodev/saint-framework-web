"use server";

// src/mastra/herald-agent.ts
//
// The Herald Agent runs exactly once per player per game — during onboarding.
// It has two jobs:
//
//   1. INTRO MONOLOGUE — before character creation.
//      Reads the lore graph and introduces the player to the world in the
//      game's own voice. Breaks the fourth wall just enough to orient them.
//      "You are about to enter Ashenveil. Here is what you need to know."
//
//   2. CLOSING MONOLOGUE — after character creation.
//      Receives the player's choices (name, backstory, items) and writes
//      a personalized send-off that fades seamlessly into the first game turn.
//      "Kael Duskmantle. The Archive is waiting."
//
// The Herald is NOT the narrator. It does not run during gameplay.
// It does not modify the world graph.
// It reads lore, speaks directly to the player, then steps aside.

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getDB } from "../../libs/surreal";
import type { LoreNode, GameRecord, PlayerCharacterTemplate } from "../../libs/types";
import { resolveGenreTone } from "../../libs/session-engine";
import { HERALD_SYSTEM_PROMPT, HERALD_VOICE } from "./prompts/herald-prompt";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// ── Herald Agent builder ───────────────────────────────────────────────────

export function buildHeraldAgent(tone: string): Agent {
    const voice = HERALD_VOICE[tone] ?? HERALD_VOICE.fantasy;

    return new Agent({
        id: "herald",
        name: "herald",
        model: openrouter("anthropic/claude-haiku-4-5"), // power model — player sees this
        instructions: `${HERALD_SYSTEM_PROMPT}\n\nVOICE FOR THIS WORLD:\n${voice}`,
        tools: {},  // no tools — pure generation from provided context
    });
}

// ── Lore context builder ───────────────────────────────────────────────────
// Reads the lore graph and assembles a compact brief for the Herald.
// The Herald only needs the world's atmosphere — not character stats.

async function buildHeraldContext(gameId: string): Promise<string> {
    const db = await getDB();

    const [events] = await db.query<[LoreNode[]]>(
        `SELECT name, description FROM lore_node WHERE kind = 'event' LIMIT 10`
    );

    // Read locations (atmosphere tells the world's feel)
    const [locations] = await db.query<[LoreNode[]]>(
        `SELECT name, description FROM lore_node WHERE kind = 'location' LIMIT 10`
    );

    // Read factions (power tells the world's politics)
    const [factions] = await db.query<[LoreNode[]]>(
        `SELECT name, description FROM lore_node WHERE kind = 'faction' LIMIT 10`
    );

    // Read concepts (ideas tell the world's themes)
    const [concepts] = await db.query<[LoreNode[]]>(
        `SELECT name, description FROM lore_node WHERE kind = 'concept' LIMIT 10`
    );

    // Read threads (tensions tell the world's stakes)
    const [threads] = await db.query<[any[]]>(
        `SELECT name, description FROM world_thread WHERE session_id = 'WORLD_INIT' LIMIT 10`
    );

    const lines: string[] = [];

    if (locations?.length) {
        lines.push("KEY LOCATIONS:");
        for (const l of locations) lines.push(`  ${l.name}: ${l.description}`);
    }
    if (factions?.length) {
        lines.push("\nFACTIONS IN PLAY:");
        for (const f of factions) lines.push(`  ${f.name}: ${f.description}`);
    }
    if (concepts?.length) {
        lines.push("\nCENTRAL IDEAS:");
        for (const c of concepts) lines.push(`  ${c.name}: ${c.description}`);
    }
    if (threads?.length) {
        lines.push("\nOPEN TENSIONS:");
        for (const t of threads) lines.push(`  ${t.name}: ${t.description}`);
    }
    if (events?.length) {
        lines.push("\nKEY EVENTS:");
        for (const e of events) lines.push(`  ${e.name}: ${e.description}`);
    }

    return lines.join("\n");
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface HeraldIntroResult {
    monologue: string;
    characterTemplate: PlayerCharacterTemplate;
}

export interface HeraldClosingResult {
    monologue: string;
}

// ── Herald Context Result ───────────────────────────────────────────────────
// Lightweight result for Herald Step 0 during turn-to-turn gameplay

export interface HeraldContextResult {
    heraldText: string;
}

/**
 * Generates the intro monologue shown before character creation.
 * Also returns the character creation template from the player_character_template table.
 */
export async function generateHeraldIntro(
    game: GameRecord,
    gameId: string
): Promise<HeraldIntroResult> {
    const tone = resolveGenreTone(game.genre);
    const herald = buildHeraldAgent(tone);
    const loreContext = await buildHeraldContext(gameId);

    // Load the character template from DB
    const db = await getDB();
    const [templateRows] = await db.query<[PlayerCharacterTemplate[]]>(
        `SELECT * FROM player_character_template WHERE game_id = $gid LIMIT 1`,
        { gid: gameId }
    );
    const characterTemplate = templateRows?.[0];

    if (!characterTemplate) {
        throw new Error(`No player_character_template found for game ${gameId}. Was the lore bible forged?`);
    }

    // Determine if this is a prebuilt character for monologue flavor
    const isPrebuilt = characterTemplate.kind === "prebuilt";

    const result = await herald.generate([
        {
            role: "user",
            content: `
Write the intro monologue for a player about to enter this world.

GAME: ${game.name}
TAGLINE: ${game.tagline}
WORLD LORE: ${loreContext}

CHARACTER TYPE: ${isPrebuilt ? "pre-built (player selects, does not customize)" : "template (player customizes)"}
CHARACTER: ${characterTemplate.base_name} — ${characterTemplate.description}

${isPrebuilt
                    ? "The player will be given this complete character. The monologue should establish who they ARE, not who they might become."
                    : "The player will customize this character. The monologue should make them want to inhabit this archetype."}

Write 1-2 paragraphs, no more than 100 words, that make the player feel the weight of what they are
about to enter. Do not explain what they will do. Do not list choices.
Make them want to step through. Make SURE to mention the game name and tagline in the very beginning.
      `.trim(),
        },
    ]);

    return {
        monologue: result.text.trim(),
        characterTemplate,
    };
}

/**
 * Generates the closing monologue after the player completes character creation.
 * Receives their choices and writes a personalized send-off.
 */
export async function generateHeraldClosing(
    game: GameRecord,
    playerChoices: {
        displayName: string;
        chosenBackstory?: string;
        chosenTraits: string[];
        chosenItems: string[];
        startingLocation: string;
    }
): Promise<HeraldClosingResult> {
    const tone = resolveGenreTone(game.genre);
    const herald = buildHeraldAgent(tone);

    const result = await herald.generate([
        {
            role: "user",
            content: `
Write the closing monologue that sends this player into the game world.

GAME: ${game.name}
CHARACTER NAME: ${playerChoices.displayName}
BACKSTORY: ${playerChoices.chosenBackstory ?? "unknown origins"}
TRAITS: ${playerChoices.chosenTraits.join(", ") || "none chosen"}
STARTING ITEMS: ${playerChoices.chosenItems.join(", ") || "nothing"}
STARTING LOCATION: ${playerChoices.startingLocation}

Write 2-4 sentences maximum. Acknowledge who they are without being sycophantic.
Place them in the world. The final line must sound like the beginning of the story —
not a goodbye, not a good luck. A beginning.

End with either:
  - Their name alone on its own line, OR
  - A single sentence that drops them into the first moment of the game
      `.trim(),
        },
    ]);

    return {
        monologue: result.text.trim(),
    };
}

/**
 * Generates brief contextual text from the Herald for Step 0 of each turn.
 * This runs BEFORE the Tremor and is purely for display — no other agent
 * depends on its output.
 * 
 * Unlike generateHeraldIntro (for onboarding), this reads the current game state
 * to write a brief scene-setting line that contextualizes what's happening.
 */
export async function generateHeraldContext(
    game: GameRecord,
    sessionId: string,
    turnNumber: number,
    previousChoice?: string
): Promise<HeraldContextResult> {
    const tone = resolveGenreTone(game.genre);
    const herald = buildHeraldAgent(tone);
    const db = await getDB();

    // Build context from current game state
    const [events] = await db.query<[any[]]>(
        `SELECT * FROM world_event 
         WHERE session_id = $sid AND resolved = false 
         ORDER BY significance DESC LIMIT 5`,
        { sid: sessionId }
    );

    const [threads] = await db.query<[any[]]>(
        `SELECT * FROM world_thread 
         WHERE session_id = $sid AND active = true 
         ORDER BY tension DESC LIMIT 5`,
        { sid: sessionId }
    );

    const [narrativeState] = await db.query<[any[]]>(
        `SELECT * FROM narrative_state WHERE session_id = $sid LIMIT 1`,
        { sid: sessionId }
    );

    const [playerSession] = await db.query<[any[]]>(
        `SELECT * FROM player_session WHERE session_id = $sid LIMIT 1`,
        { sid: sessionId }
    );

    // Build context summary
    const activeEvents = events?.map(e => e.name).join(", ") || "nothing significant";
    const activeThreads = threads?.map(t => t.name).join(", ") || "no open threads";
    const phase = narrativeState?.[0]?.current_phase || "ordinary_world";
    const phaseCharge = narrativeState?.[0]?.phase_charge || 0;

    // Player state
    const playerState = playerSession?.[0]
        ? `Moral stance: ${playerSession[0].moral_polarity?.toFixed(2) || 0}, Approach: ${playerSession[0].method_intensity?.toFixed(2) || 0}`
        : "unknown";

    const result = await herald.generate([
        {
            role: "user",
            content: `
Write a contextual introduction that sets the tone for this moment in the story. Do not make it too long, 5-8 sentences max.

GAME: ${game.name}
TURN: ${turnNumber}

CURRENT NARRATIVE PHASE: ${phase}
PHASE PROGRESS: ${(phaseCharge * 100).toFixed(0)}% through this phase

ACTIVE EVENTS: ${activeEvents}
OPEN THREADS: ${activeThreads}

PLAYER STATE: ${playerState}
${previousChoice ? `THE PLAYER JUST CHOSE: "${previousChoice}"` : ""}

Set the tone for the next scene. Do not make it too long, 5-8 sentences max. Don't ask "what is your name?" or any other
character related questions. Stick purely to setting the scene and preparing the player for the journey they're about to
embark on. 
            `.trim(),
        },
    ]);

    return {
        heraldText: result.text.trim(),
    };
}
