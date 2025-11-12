import { createSignal, Show, For } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import './GameDetail.css';

export default function GameDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<'overview' | 'analytics' | 'requirements'>('overview');
  const [currentImageIndex, setCurrentImageIndex] = createSignal(0);

  // Mock game data - in a real app, this would be fetched based on params.gameTitle
  const gameData = {
    title: params.gameTitle?.replace(/-/g, ' ') || 'Game Title',
    description: 'Navigate the neon-lit streets of a cyberpunk future where AI and humanity merge.',
    developer: 'NeonCode Interactive',
    rating: 4.6,
    reviews: 156,
    releaseDate: '2/19/2024',
    tags: ['Cyberpunk', 'Hacking', 'Futuristic', 'Action'],
    isFree: true,
    price: 19.99,
    images: ['/placeholder1.jpg', '/placeholder2.jpg', '/placeholder3.jpg']
  };

  const handleBackToGames = () => {
    navigate('/play');
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % gameData.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + gameData.images.length) % gameData.images.length);
  };

  return (
    <div class="game-detail">
      {/* Back Button */}
      <button class="back-to-games" onClick={handleBackToGames}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Back to Games
      </button>

      {/* Header Section */}
      <div class="game-detail-header">
        <div class="game-title-section">
          <h1 class="game-detail-title">{gameData.title}</h1>
          <Show when={gameData.isFree}>
            <span class="free-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 12v10H4V12h16zm0-2H4V7h16v3zm-8 6h6v-2h-6v2zm0 3h6v-2h-6v2zm-4-3h2v-2H8v2zm0 3h2v-2H8v2zM4 3h16a2 2 0 0 1 2 2v1H2V5a2 2 0 0 1 2-2z"/>
              </svg>
              FREE TO PLAY
            </span>
          </Show>
          <p class="game-subtitle">{gameData.description}</p>
        </div>

        <div class="game-meta-info">
          <div class="meta-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2"/>
              <circle cx="12" cy="7" r="4" stroke-width="2"/>
            </svg>
            <span>By {gameData.developer}</span>
          </div>
          <div class="meta-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span>{gameData.rating} ({gameData.reviews} reviews)</span>
          </div>
          <div class="meta-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke-width="2"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke-width="2"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke-width="2"/>
            </svg>
            <span>{gameData.releaseDate}</span>
          </div>
        </div>

        <div class="game-tags">
          <For each={gameData.tags}>
            {(tag) => <span class="tag">{tag}</span>}
          </For>
        </div>
      </div>

      {/* Image Carousel */}
      <div class="game-carousel">
        <div class="carousel-image">
          <div class="carousel-placeholder"></div>
          <button class="carousel-btn prev" onClick={prevImage}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M15 18l-6-6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="carousel-btn next" onClick={nextImage}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 18l6-6-6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="carousel-thumbnails">
          <For each={gameData.images}>
            {(_, index) => (
              <div
                class={`thumbnail ${index() === currentImageIndex() ? 'active' : ''}`}
                onClick={() => setCurrentImageIndex(index())}
              >
                <div class="thumbnail-placeholder"></div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Sidebar with price/action buttons */}
      <div class="game-sidebar-info">
        <Show
          when={gameData.isFree}
          fallback={
            <>
              <div class="price-section">
                <div class="price">${gameData.price}</div>
                <div class="price-label">One-time purchase</div>
              </div>
              <button class="buy-now-btn">Buy Now</button>
            </>
          }
        >
          <div class="free-section">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 12v10H4V12h16zm0-2H4V7h16v3zm-8 6h6v-2h-6v2zm0 3h6v-2h-6v2zm-4-3h2v-2H8v2zm0 3h2v-2H8v2zM4 3h16a2 2 0 0 1 2 2v1H2V5a2 2 0 0 1 2-2z"/>
            </svg>
            <div class="free-title">FREE TO PLAY</div>
            <div class="free-subtitle">No purchase required</div>
          </div>
          <button class="play-now-btn">Play Now</button>
        </Show>
        <button class="wishlist-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke-width="2"/>
          </svg>
          Add to Wishlist
        </button>
      </div>

      {/* Tabs Navigation */}
      <div class="tabs-navigation">
        <button
          class={`tab-btn ${activeTab() === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <path d="M12 16v-4M12 8h.01" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Overview
        </button>
        <button
          class={`tab-btn ${activeTab() === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 3v18h18" stroke-width="2" stroke-linecap="round"/>
            <path d="M18 17V9M13 17v-6M8 17v-3" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Analytics
        </button>
        <button
          class={`tab-btn ${activeTab() === 'requirements' ? 'active' : ''}`}
          onClick={() => setActiveTab('requirements')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="2" y="3" width="20" height="14" rx="2" stroke-width="2"/>
            <path d="M8 21h8M12 17v4" stroke-width="2" stroke-linecap="round"/>
          </svg>
          System Requirements
        </button>
      </div>

      {/* Tab Content */}
      <div class="tab-content">
        <Show when={activeTab() === 'overview'}>
          <div class="overview-content">
            <h2>About This Game</h2>
            <p>
              Command your own pirate ship across vast oceans filled with danger and adventure. Recruit a diverse crew, engage in epic
              naval battles, explore mysterious islands, and search for the legendary treasure of Captain Blackwater. With dynamic weather
              systems and realistic sailing mechanics, every voyage is unique.
            </p>

            <div class="features-updates">
              <div class="features-section">
                <h3>Game Features</h3>
                <ul>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Immersive storyline with multiple endings
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Advanced character customization
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Dynamic weather and day/night cycle
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Cross-platform multiplayer support
                  </li>
                </ul>
              </div>

              <div class="updates-section">
                <h3>Recent Updates</h3>
                <div class="update-item">
                  <div class="update-header">
                    <span class="update-version">Version 2.1.4</span>
                    <span class="update-date">2/27/2024</span>
                  </div>
                  <p class="update-description">Bug fixes and performance improvements</p>
                </div>
              </div>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'analytics'}>
          <div class="analytics-content">
            <h2>Game Analytics</h2>
            <div class="analytics-grid">
              <div class="analytics-card">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke-width="2"/>
                  <circle cx="9" cy="7" r="4" stroke-width="2"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke-width="2"/>
                </svg>
                <div class="analytics-value">3,892</div>
                <div class="analytics-label">Peak Players</div>
              </div>
              <div class="analytics-card">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" stroke-width="2"/>
                  <path d="M12 6v6l4 2" stroke-width="2"/>
                </svg>
                <div class="analytics-value">56.7 hours</div>
                <div class="analytics-label">Avg. Playtime</div>
              </div>
              <div class="analytics-card">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <div class="analytics-value">82%</div>
                <div class="analytics-label">Completion Rate</div>
              </div>
              <div class="analytics-card">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <div class="analytics-value">4.7</div>
                <div class="analytics-label">User Rating</div>
              </div>
            </div>

            <div class="activity-stats">
              <div class="stat-section">
                <h3>Player Activity</h3>
                <div class="stat-row">
                  <span>Current Players</span>
                  <span class="stat-value">2,156</span>
                </div>
                <div class="stat-row">
                  <span>24h Peak</span>
                  <span class="stat-value">3,113</span>
                </div>
                <div class="stat-row">
                  <span>All-time Peak</span>
                  <span class="stat-value highlight">3,892</span>
                </div>
              </div>

              <div class="stat-section">
                <h3>Community Stats</h3>
                <div class="stat-row">
                  <span>Total Reviews</span>
                  <span class="stat-value">428</span>
                </div>
                <div class="stat-row">
                  <span>Positive Reviews</span>
                  <span class="stat-value positive">402</span>
                </div>
                <div class="stat-row">
                  <span>Swarm Size</span>
                  <span class="stat-value highlight">300</span>
                </div>
              </div>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'requirements'}>
          <div class="requirements-content">
            <h2>System Requirements</h2>
            <div class="requirements-grid">
              <div class="requirements-card">
                <div class="requirements-header">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="2" y="3" width="20" height="14" rx="2" stroke-width="2"/>
                    <path d="M8 21h8M12 17v4" stroke-width="2"/>
                  </svg>
                  <h3>Minimum Requirements</h3>
                </div>
                <div class="requirements-list">
                  <div class="requirement-item">
                    <strong>OS:</strong> Windows 10 64-bit
                  </div>
                  <div class="requirement-item">
                    <strong>Processor:</strong> Intel i5-4590 / AMD FX 8350
                  </div>
                  <div class="requirement-item">
                    <strong>Memory:</strong> 8 GB RAM
                  </div>
                  <div class="requirement-item">
                    <strong>Graphics:</strong> NVIDIA GTX 960 / AMD R9 280X
                  </div>
                  <div class="requirement-item">
                    <strong>Storage:</strong> 30 GB available space
                  </div>
                </div>
              </div>

              <div class="requirements-card">
                <div class="requirements-header">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  <h3>Recommended Requirements</h3>
                </div>
                <div class="requirements-list">
                  <div class="requirement-item">
                    <strong>OS:</strong> Windows 11 64-bit
                  </div>
                  <div class="requirement-item">
                    <strong>Processor:</strong> Intel i7-8700K / AMD Ryzen 5 3600
                  </div>
                  <div class="requirement-item">
                    <strong>Memory:</strong> 16 GB RAM
                  </div>
                  <div class="requirement-item">
                    <strong>Graphics:</strong> NVIDIA RTX 3060 / AMD RX 6600 XT
                  </div>
                  <div class="requirement-item">
                    <strong>Storage:</strong> 30 GB available space (SSD recommended)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Game Info Sidebar (right side) */}
      <div class="game-info-sidebar">
        <div class="info-section">
          <h3>Game Info</h3>
          <div class="info-row">
            <span>Players:</span>
            <span>2,156</span>
          </div>
          <div class="info-row">
            <span>Swarm Size:</span>
            <span>300</span>
          </div>
          <div class="info-row">
            <span>Genre:</span>
            <span>Adventure</span>
          </div>
          <div class="info-row">
            <span>Rating:</span>
            <span>4.7 ⭐</span>
          </div>
          <div class="info-row">
            <span>Reviews:</span>
            <span>428</span>
          </div>
          <div class="info-row">
            <span>Release Date:</span>
            <span>1/7/2024</span>
          </div>
        </div>

        <div class="creator-section">
          <h3>Creator</h3>
          <div class="creator-info">
            <div class="creator-avatar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div class="creator-details">
              <div class="creator-name">Seafaring Games</div>
              <div class="creator-role">Game Developer</div>
            </div>
          </div>
          <button class="follow-creator-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Follow Creator
          </button>
        </div>
      </div>
    </div>
  );
}
