"use server";

import { getDB } from "~/libs/surreal";
import type { GameRecord } from "~/libs/types";

export async function fetchGameBySlugServer(slug: string): Promise<GameRecord | null> {
  if (!slug) return null;

  try {
    const db = await getDB();

    const toSlug = (name: string) =>
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const [candidates] = await db.query<[any[]]>(`
      SELECT * FROM game
      WHERE visibility = 'public' OR status = 'ready'
      LIMIT 200
    `);

    const game = (candidates ?? []).find(
      (g: any) => toSlug(g.name ?? "") === slug
    ) ?? null;

    if (!game) {
      return null;
    }

    const rawResponse = { ...game, id: game.id?.toString?.() ?? String(game.id) };
    
    // Strip complex SurrealDB proprietary classes (DateTime, RecordId, etc.) into safe primitives 
    // so SolidStart 'seroval' stream transport component doesn't hard-crash.
    return JSON.parse(JSON.stringify(rawResponse)) as GameRecord;
  } catch (err) {
    return null;
  }
}
