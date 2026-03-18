"use server";

import { getPublicGames } from "./game";
import type { GameCardData } from "~/components/GameCard";

export async function fetchPublicGamesServer(): Promise<GameCardData[]> {
  try {
    const records = await getPublicGames();
    const now = Date.now();
    return records.map(g => {
      const idStr = (g.id as any)?.toString?.() ?? String(g.id);
      return {
        id: idStr,
        cost: g.cost,
        gameId: idStr,
        title: g.name,
        image: g.cover_image ?? undefined,
        created: g.created_at ? new Date(g.created_at).toLocaleDateString("en-US") : "—",
        players: 0,
        swarmSize: g.world_agents ?? 0,
        genre: g.genre || "Adventure",
        price: undefined,
        isFree: true,
        isNew: g.created_at
          ? now - new Date(g.created_at).getTime() < 1000 * 60 * 60 * 24 * 14
          : false,
        description: g.description,
        createdBy: g.created_by,
        tagline: g.tagline,
        tags: g.tags,
      };
    });
  } catch (e) {
    console.error("[fetchPublicGamesServer] error:", e);
    return [];
  }
}
