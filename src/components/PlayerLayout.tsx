import { createSignal, For } from 'solid-js';
import './PlayerLayout.css';

interface GameProgress {
    id: string;
    title: string;
    lastPlayed: string;
    progress: number;
    status: 'playing' | 'completed' | 'paused';
    image: string;
}

interface PurchasedGame {
    id: string;
    title: string;
    hoursPlayed: number;
    image: string;
}

const savedGames: GameProgress[] = [
    {
        id: '1',
        title: 'Mystic Realms: The Awakening',
        lastPlayed: '2/29/2024',
        progress: 75,
        status: 'playing',
        image: '/saint hero image.png'
    },
    {
        id: '2',
        title: "Pirate's Paradox",
        lastPlayed: '2/27/2024',
        progress: 45,
        status: 'playing',
        image: '/saint hero.png'
    }
];

const purchasedGames: PurchasedGame[] = [
    {
        id: '3',
        title: 'Cyber Chronicles 2087',
        hoursPlayed: 120,
        image: '/saint hero image.png'
    },
    {
        id: '4',
        title: 'Space Station Alpha',
        hoursPlayed: 45,
        image: '/saint hero.png'
    },
    {
        id: '5',
        title: 'Quantum Mysteries',
        hoursPlayed: 12,
        image: '/saint hero image.png'
    }
];

export default function PlayerLayout() {
    const [activeSection, setActiveSection] = createSignal('profile');

    return (
        <div class="player-layout">
            {/* Sidebar */}
            <aside class="player-sidebar">
                <div class="sidebar-header">
                    <h2 class="sidebar-title">Account</h2>
                </div>

                <nav class="sidebar-nav">
                    <button
                        class={`nav-item ${activeSection() === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveSection('profile')}
                    >
                        <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            <circle cx="12" cy="7" r="4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <span>My Profile</span>
                    </button>

                    <button class="nav-item">
                        <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <span>Settings</span>
                    </button>

                    <button class="nav-item">
                        <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="2" y="5" width="20" height="14" rx="2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M2 10h20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <span>Billing</span>
                    </button>
                </nav>

                <div class="sidebar-section">
                    <h3 class="section-title">Library</h3>
                    <nav class="sidebar-nav">
                        <button class="nav-item">
                            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            <span>All Games</span>
                        </button>

                        <button class="nav-item">
                            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            <span>Saved</span>
                        </button>

                        <button class="nav-item">
                            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="12" cy="12" r="10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <polyline points="12 6 12 12 16 14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            <span>History</span>
                        </button>
                    </nav>
                </div>
            </aside>

            {/* Main Content */}
            <main class="player-content">
                {/* Profile Header */}
                <div class="profile-header">
                    <div class="banner-container">
                        <img src="/saint hero image.png" alt="Profile Banner" class="banner-image" />
                        <div class="banner-overlay"></div>
                    </div>

                    <div class="profile-info">
                        <div class="avatar-container">
                            <img src="/saint hero.png" alt="Profile Avatar" class="avatar-image" />
                        </div>

                        <div class="profile-details">
                            <div class="username-section">
                                <h1 class="username">AlexVance_99</h1>
                                <p class="member-info">Member since 2022 • Level 42</p>
                            </div>

                            <div class="profile-actions">
                                <button class="btn-primary">Edit Profile</button>
                                <button class="btn-secondary">Share</button>
                            </div>
                        </div>

                        <div class="stats-container">
                            <div class="stat-item">
                                <span class="stat-value">128</span>
                                <span class="stat-label">GAMES OWNED</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">1,402</span>
                                <span class="stat-label">HOURS PLAYED</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">34</span>
                                <span class="stat-label">ACHIEVEMENTS</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Saved Games Section */}
                <section class="games-section">
                    <h2 class="section-heading">Saved Games</h2>
                    <div class="games-grid">
                        <For each={savedGames}>
                            {(game) => (
                                <div class="game-card">
                                    <div class="game-image-container">
                                        <img src={game.image} alt={game.title} class="game-image" />
                                        <div class="game-overlay"></div>
                                    </div>
                                    <div class="game-info">
                                        <h3 class="game-title">{game.title}</h3>
                                        <p class="game-meta">Last played: {game.lastPlayed}</p>
                                        <div class="progress-container">
                                            <div class="progress-bar">
                                                <div class="progress-fill" style={`width: ${game.progress}%`}></div>
                                            </div>
                                            <span class="progress-text">{game.progress}%</span>
                                        </div>
                                        <button class="btn-resume">RESUME</button>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </section>

                {/* Purchased Games Section */}
                <section class="games-section">
                    <h2 class="section-heading">Purchased Games</h2>
                    <div class="games-grid purchased-grid">
                        <For each={purchasedGames}>
                            {(game) => (
                                <div class="game-card purchased-card">
                                    <div class="game-image-container">
                                        <img src={game.image} alt={game.title} class="game-image" />
                                        <div class="game-overlay"></div>
                                    </div>
                                    <div class="game-info">
                                        <h3 class="game-title">{game.title}</h3>
                                        <p class="game-meta">{game.hoursPlayed} hours played</p>
                                        <button class="btn-play">PLAY</button>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </section>
            </main>
        </div>
    );
}