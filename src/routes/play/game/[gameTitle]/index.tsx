import { createResource, Show } from 'solid-js';
import { useParams } from '@solidjs/router';
import GameDetail from '~/components/GameDetail';
import type { GameRecord } from '~/libs/types';

export default function GameDetailPage() {
  const params = useParams();
  const slug = params.gameTitle;

  const [game] = createResource(
    () => slug,
    async (slug: string) => {
      if (!slug) return null;
      try {
        const res = await fetch(`/api/games/by-slug/${slug}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.game as GameRecord;
      } catch {
        return null;
      }
    }
  );

  return (
    <Show when={game()} fallback={<GameDetail />}>
      <GameDetail game={game()!} />
    </Show>
  );
}
