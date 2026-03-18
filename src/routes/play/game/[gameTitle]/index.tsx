import { Show, createResource } from 'solid-js';
import { useParams, useLocation } from '@solidjs/router';
import GameDetail from '~/components/GameDetail';
import type { GameRecord } from '~/libs/types';
import { fetchGameBySlugServer } from '~/libs/serverGameDetail';

export default function GameDetailPage() {
  const params = useParams();
  const location = useLocation<any>();

  const stateGame = location.state?.game;

  const [game] = createResource(
    () => params.gameTitle,
    async (slug) => {
      return await fetchGameBySlugServer(slug as string);
    }
  );

  // If we have state data (from clicking a card), show it immediately.
  // We avoid reading game() while it's loading to prevent Suspense from blocking the instant transition.
  const activeGame = () => {
    // If we have local state and the network is still fetching, show local state immediately.
    if (stateGame && game.loading) {
      return {
        ...stateGame,
        name: stateGame.title,
        description: stateGame.description || '',
        tagline: stateGame.tagline || '',
        tags: stateGame.tags || [],
        created_by: stateGame.createdBy || 'Unknown Creator',
        created_at: stateGame.created,
        cost: stateGame.price ? stateGame.price * 100 : 0,
        world_agents: stateGame.swarmSize
      } as GameRecord;
    }

    // Once loaded (or if we have no state fallback), read the actual game
    const dbGame = game();
    if (dbGame) return dbGame;

    // Fallback if DB returns null
    if (stateGame) {
      return {
        ...stateGame,
        name: stateGame.title,
        description: stateGame.description || '',
        tagline: stateGame.tagline || '',
        tags: stateGame.tags || [],
        created_by: stateGame.createdBy || 'Unknown Creator',
        created_at: stateGame.created,
        cost: stateGame.price ? stateGame.price * 100 : 0,
        world_agents: stateGame.swarmSize
      } as GameRecord;
    }

    return undefined;
  };

  return (
    <Show when={activeGame()} fallback={<GameDetail />}>
      <GameDetail game={activeGame()!} />
    </Show>
  );
}
