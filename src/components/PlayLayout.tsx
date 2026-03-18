"use client";
// src/components/PlayLayout.tsx

import { createSignal, For, Show, Suspense } from 'solid-js';
import { createAsync, cache } from '@solidjs/router';
import { useAuth } from '~/libs/AuthProvider';
import GameSidebar from './GameSidebar';
import Carousel from './Carousel';
import GameCard, { type GameCardData } from './GameCard';
import './PlayLayout.css';

// ── Server action ───────────────────────────────────────────────────────────
// cache() + "use server" means this runs in the server process on SSR
// and is called via RPC on subsequent client navigations.
// This avoids the relative-URL fetch problem (fetch('/api/...') fails on server).

const loadPublicGames = cache(async (): Promise<GameCardData[]> => {
  "use server";
  try {
    const { getPublicGames } = await import('~/libs/game');
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
        created: g.created_at ? new Date(g.created_at).toLocaleDateString('en-US') : '—',
        players: 0,
        swarmSize: g.world_agents ?? 0,
        genre: g.genre || 'Adventure',
        price: undefined,
        isFree: true,
        isNew: g.created_at
          ? (now - new Date(g.created_at).getTime()) < 1000 * 60 * 60 * 24 * 14
          : false,
      };
    });
  } catch (e) {
    console.error('[loadPublicGames] error:', e);
    return [];
  }
}, 'public-games');

// ── Component ───────────────────────────────────────────────────────────────

export default function PlayLayout() {
  const { isAuthenticated } = useAuth();
  const [activeView, setActiveView] = createSignal('games');

  // createAsync works during SSR and client-side — no relative URL problem.
  const apiPublicGames = createAsync(() => loadPublicGames());

  // Fall back to mock data while loading or if DB returns empty.
  const publicGames = () => {
    const loaded = apiPublicGames();
    return loaded && loaded.length > 0 ? loaded : mockPublicGames;
  };

  return (
    <>
      <div class="play-layout">
        <GameSidebar activeView={activeView()} onViewChange={setActiveView} />

        <main class="play-content">
          <Show when={activeView() === 'games'}>
            <div class="games-view">

              {/* Featured Games Section */}
              <section class="game-section">
                <h2 class="section-title">Featured Games</h2>
                <Carousel />
              </section>

              {/* Dropdown Placeholders */}
              <div class="filter-controls">
                <button class="filter-btn">
                  <span>All Genres</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <button class="filter-btn">
                  <span>All Swarm Sizes</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>

              {/* Free Games Section */}
              <section class="game-section">
                <h2 class="section-title">Free Games</h2>
                <Suspense fallback={<SectionSkeleton />}>
                  <div class="game-grid">
                    <For each={publicGames().filter(g => g.isFree)}>
                      {(game) => <GameCard game={game} />}
                    </For>
                  </div>
                </Suspense>
              </section>

              <hr class="section-divider" />

              {/* Popular Games Section */}
              <section class="game-section">
                <h2 class="section-title">Popular Games</h2>
                <div class="game-grid">
                  <For each={mockPopularGames}>
                    {(game) => <GameCard game={game} />}
                  </For>
                </div>
              </section>

              <hr class="section-divider" />

              {/* New Games Section */}
              <section class="game-section">
                <h2 class="section-title">New Games</h2>
                <Suspense fallback={<SectionSkeleton />}>
                  <div class="game-grid">
                    <For each={publicGames().filter(g => g.isNew)}>
                      {(game) => <GameCard game={game} />}
                    </For>
                  </div>
                </Suspense>
              </section>

            </div>
          </Show>

          <Show when={activeView() === 'plugins'}>
            <div class="coming-soon-view">
              <h2>Plugins</h2>
              <p>This feature is coming soon!</p>
            </div>
          </Show>

          <Show when={activeView() === 'themes'}>
            <div class="coming-soon-view">
              <h2>Themes</h2>
              <p>This feature is coming soon!</p>
            </div>
          </Show>
        </main>
      </div>
    </>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div class="game-grid">
      {Array(3).fill(0).map(() => (
        <div class="game-card" style="opacity: 0.4; pointer-events: none;">
          <div class="game-card-image">
            <div class="game-placeholder-gradient" style="animation: pulse 1.5s ease infinite;" />
          </div>
          <div class="game-card-content">
            <div style="height: 16px; background: #1e293b; border-radius: 4px; margin-bottom: 8px;" />
            <div style="height: 12px; background: #1e293b; border-radius: 4px; width: 60%;" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mock data ────────────────────────────────────────────────────────────────
// Shown while loading or when no games are published yet.

const mockFeaturedGames: GameCardData[] = [
  {
    id: '1',
    title: 'Mystic Realms: The Awakening',
    created: '1/14/2024',
    players: 1247,
    swarmSize: 150,
    genre: 'Fantasy',
    price: 24.99,
  },
];

const mockPublicGames: GameCardData[] = [
  {
    id: '2',
    title: 'Cyber Chronicles 2087',
    created: '2/19/2024',
    players: 892,
    swarmSize: 200,
    genre: 'Sci-Fi',
    isFree: true,
  },
  {
    id: '3',
    title: 'Quantum Mysteries',
    created: '2/27/2024',
    players: 534,
    swarmSize: 75,
    genre: 'Puzzle',
    isFree: true,
  },
  {
    id: '4',
    title: 'Space Station Alpha',
    created: '2/9/2024',
    players: 976,
    swarmSize: 180,
    genre: 'Sci-Fi',
    isFree: true,
  },
];

const mockPopularGames: GameCardData[] = [
  {
    id: '5',
    title: 'Mystic Realms: The Awakening',
    created: '1/14/2024',
    players: 1247,
    swarmSize: 150,
    genre: 'Fantasy',
    price: 24.99,
  },
  {
    id: '6',
    title: "Pirate's Paradox",
    created: '1/7/2024',
    players: 2156,
    swarmSize: 300,
    genre: 'Adventure',
    price: 19.99,
  },
  {
    id: '7',
    title: 'Dark Woods Horror',
    created: '1/23/2024',
    players: 1689,
    swarmSize: 120,
    genre: 'Horror',
    price: 16.99,
  },
];