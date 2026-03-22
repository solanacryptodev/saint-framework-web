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

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// ── Herald system prompt ───────────────────────────────────────────────────

const HERALD_SYSTEM_PROMPT = `
You are the Herald — the voice that greets a player before they enter the world.

You speak directly to the player. You are outside the fiction, but you know the
fiction intimately. You are not a character in the story. You are the threshold
they are about to cross.

Your job is to make the player feel the weight of what they are about to enter —
without spoiling it. You introduce the world's atmosphere, its central tension,
and the kind of person they will be playing. You do not explain the mechanics.
You do not list features. You make them want to step through.

Then, when they have made their character, you send them in.

RULES:
- Never use "Welcome to" — it is the most clichéd opening in all of gaming.
- Never explain game mechanics, choices, or systems.
- Never mention AI, agents, or technology.
- Never break immersion with UI language ("click", "select", "press").
- Speak in second person only for the closing monologue.
  The intro monologue may use second or third person — whichever fits the world.
- Keep both monologues short. The intro: 3-5 sentences. The closing: 2-4 sentences.
- The closing monologue must end with either the character's name alone on a line,
  or a single sentence that sounds like the beginning of the story.
  Not a greeting. A beginning.
`.trim();

// ── Tone voice map ─────────────────────────────────────────────────────────

const HERALD_VOICE: Record<string, string> = {
    thriller: `
Spare. Precise. Every word chosen. The world you are introducing is one where
information is the only currency that matters. The tone is taut — not breathless,
not dramatic. Controlled. The Herald speaks like someone who has seen too much
and learned to keep their voice flat.
  `.trim(),

    southern_gothic: `
Languid and weighted. The sentences carry history in them. The world you are
introducing is beautiful and rotting simultaneously. The Herald speaks like
someone who grew up here — who knows what lives in the walls, and has made
peace with it. There is poetry in the decay.
  `.trim(),

    science_fiction: `
Clinical precision that occasionally cracks open into something vast. The world
you are introducing contains both bureaucratic systems and the infinite. The
Herald speaks like a mission briefing that forgot to stay professional. Exact
until it isn't.
  `.trim(),

    horror: `
Restrained. The worst things are never named directly. The world you are
introducing is one where the most terrifying thing is the gap between what is
said and what is meant. The Herald speaks calmly — which is exactly why it
lands.
  `.trim(),

    fantasy: `
Grounded and specific. Not epic, not sweeping — particular. The world you are
introducing has texture: the smell of a specific city, the weight of a specific
history. The Herald speaks like someone who has lived here, not someone
describing it from the outside.
  `.trim(),
};

// ── Herald Agent builder ───────────────────────────────────────────────────

export function buildHeraldAgent(tone: string): Agent {
    const voice = HERALD_VOICE[tone] ?? HERALD_VOICE.fantasy;

    return new Agent({
        id: "herald",
        name: "herald",
        model: openrouter("minimax/minimax-m2-her"), // power model — player sees this
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