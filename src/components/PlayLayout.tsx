import { createSignal, For, Show } from 'solid-js';
import GameSidebar from './GameSidebar';
import Carousel from './Carousel';
import GameCard, { type GameCardData } from './GameCard';
import './PlayLayout.css';

// Dummy game data
const featuredGames: GameCardData[] = [
  {
    id: '1',
    title: 'Mystic Realms: The Awakening',
    created: '1/14/2024',
    players: 1247,
    swarmSize: 150,
    genre: 'Fantasy',
    price: 24.99
  }
];

const freeGames: GameCardData[] = [
  {
    id: '2',
    title: 'Cyber Chronicles 2087',
    created: '2/19/2024',
    players: 892,
    swarmSize: 200,
    genre: 'Sci-Fi',
    isFree: true
  },
  {
    id: '3',
    title: 'Quantum Mysteries',
    created: '2/27/2024',
    players: 534,
    swarmSize: 75,
    genre: 'Puzzle',
    isFree: true
  },
  {
    id: '4',
    title: 'Space Station Alpha',
    created: '2/9/2024',
    players: 976,
    swarmSize: 180,
    genre: 'Sci-Fi',
    isFree: true
  }
];

const popularGames: GameCardData[] = [
  {
    id: '5',
    title: 'Mystic Realms: The Awakening',
    created: '1/14/2024',
    players: 1247,
    swarmSize: 150,
    genre: 'Fantasy',
    price: 24.99
  },
  {
    id: '6',
    title: "Pirate's Paradox",
    created: '1/7/2024',
    players: 2156,
    swarmSize: 300,
    genre: 'Adventure',
    price: 19.99
  },
  {
    id: '7',
    title: 'Dark Woods Horror',
    created: '1/23/2024',
    players: 1689,
    swarmSize: 120,
    genre: 'Horror',
    price: 16.99
  }
];

const newGames: GameCardData[] = [
  {
    id: '8',
    title: 'Cyber Chronicles 2087',
    created: '2/19/2024',
    players: 892,
    swarmSize: 200,
    genre: 'Sci-Fi',
    isFree: true,
    isNew: true
  },
  {
    id: '9',
    title: 'Quantum Mysteries',
    created: '2/27/2024',
    players: 534,
    swarmSize: 75,
    genre: 'Puzzle',
    isFree: true,
    isNew: true
  },
  {
    id: '10',
    title: 'Space Station Alpha',
    created: '2/9/2024',
    players: 976,
    swarmSize: 180,
    genre: 'Sci-Fi',
    isFree: true,
    isNew: true
  }
];

export default function PlayLayout() {
  const [activeView, setActiveView] = createSignal('games');

  return (
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
                  <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="filter-btn">
                <span>All Swarm Sizes</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Free Games Section */}
            <section class="game-section">
              <h2 class="section-title">Free Games</h2>
              <div class="game-grid">
                <For each={freeGames}>
                  {(game) => <GameCard game={game} />}
                </For>
              </div>
            </section>

            {/* Popular Games Section */}
            <section class="game-section">
              <h2 class="section-title">Popular Games</h2>
              <div class="game-grid">
                <For each={popularGames}>
                  {(game) => <GameCard game={game} />}
                </For>
              </div>
            </section>

            {/* New Games Section */}
            <section class="game-section">
              <h2 class="section-title">New Games</h2>
              <div class="game-grid">
                <For each={newGames}>
                  {(game) => <GameCard game={game} />}
                </For>
              </div>
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
  );
}
