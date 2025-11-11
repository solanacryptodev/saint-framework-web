import { For, createSignal } from 'solid-js';
import './GameSidebar.css';

interface GameProgress {
  name: string;
  lastPlayed: string;
  progress: number;
  status: 'playing' | 'completed' | 'paused';
}

const dummyGameProgress: GameProgress[] = [
  { name: 'Mystic Realms', lastPlayed: '3/20/2024', progress: 75, status: 'playing' },
  { name: "Pirate's Paradox", lastPlayed: '2/27/2024', progress: 100, status: 'completed' },
  { name: 'Dark Woods Horror', lastPlayed: '2/24/2024', progress: 45, status: 'paused' }
];

interface GameSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function GameSidebar(props: GameSidebarProps) {
  const [isCollapsed, setIsCollapsed] = createSignal(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed());
  };

  return (
    <aside class={`game-sidebar ${isCollapsed() ? 'collapsed' : ''}`}>
      <div class="sidebar-header">
        <h2 class={`sidebar-title ${isCollapsed() ? 'hidden' : ''}`}>Browse</h2>
        <button 
          class="collapse-btn"
          onClick={toggleSidebar}
          aria-label={isCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg 
            class="collapse-icon" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
          >
            <path d={isCollapsed() ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <nav class={`sidebar-nav ${isCollapsed() ? 'hidden' : ''}`}>
        <button 
          class={`nav-item ${props.activeView === 'games' ? 'active' : ''}`}
          onClick={() => props.onViewChange('games')}
        >
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Games</span>
        </button>

        <button class="nav-item disabled">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2v6m0 0L9 5m3 3l3-3M2 17l3.5-3.5m0 0L8 16m-2.5-2.5L8 11M22 17l-3.5-3.5m0 0L16 16m2.5-2.5L16 11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Plugins</span>
          <span class="coming-soon">~ Coming Soon</span>
        </button>

        <button class="nav-item disabled">
          <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Themes</span>
          <span class="coming-soon">~ Coming Soon</span>
        </button>
      </nav>

      <div class={`my-games ${isCollapsed() ? 'hidden' : ''}`}>
        <h3 class="my-games-title">My Games</h3>
        <div class="my-games-list">
          <For each={dummyGameProgress}>
            {(game) => (
              <div class="game-progress-item">
                <div class="game-progress-header">
                  <span class="game-name">{game.name}</span>
                  {game.status === 'completed' && (
                    <svg class="status-icon completed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <polyline points="22 4 12 14.01 9 11.01" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  )}
                  {game.status === 'paused' && (
                    <svg class="status-icon paused" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  )}
                </div>
                <div class="game-meta">
                  <span class="last-played">Last played: {game.lastPlayed}</span>
                  <span class="progress-percentage">{game.progress}%</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style={`width: ${game.progress}%`}></div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </aside>
  );
}
