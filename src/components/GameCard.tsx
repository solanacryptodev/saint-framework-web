import { createSignal } from 'solid-js';
import './GameCard.css';

export interface GameCardData {
  id: string;
  title: string;
  image?: string;
  created: string;
  players: number;
  swarmSize: number;
  genre: string;
  price?: number;
  isFree?: boolean;
  isNew?: boolean;
}

interface GameCardProps {
  game: GameCardData;
}

export default function GameCard(props: GameCardProps) {
  const [isFavorited, setIsFavorited] = createSignal(false);

  const toggleFavorite = (e: MouseEvent) => {
    e.preventDefault();
    setIsFavorited(!isFavorited());
  };

  return (
    <div class="game-card">
      <div class="game-card-image">
        {/* Placeholder gradient background */}
        <div class="game-placeholder-gradient"></div>
        
        {/* Badges */}
        {props.game.isFree && (
          <span class="game-badge free">FREE</span>
        )}
        {props.game.isNew && (
          <span class="game-badge new">NEW</span>
        )}

        {/* Heart/Favorite Button */}
        <button 
          class={`favorite-btn ${isFavorited() ? 'favorited' : ''}`}
          onClick={toggleFavorite}
          aria-label={isFavorited() ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorited() ? 'currentColor' : 'none'} stroke="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <div class="game-card-content">
        <h3 class="game-card-title">{props.game.title}</h3>
        
        <div class="game-card-meta">
          <div class="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Created: {props.game.created}</span>
          </div>

          <div class="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Players: {props.game.players}</span>
          </div>

          <div class="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Swarm Size: {props.game.swarmSize}</span>
          </div>

          <div class="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="4" y1="22" x2="4" y2="15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Genre: {props.game.genre}</span>
          </div>

          {props.game.price !== undefined && (
            <div class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="12" y1="1" x2="12" y2="23" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Price: ${props.game.price.toFixed(2)}</span>
            </div>
          )}
        </div>

        <button class="show-more-btn">
          Show More
        </button>
      </div>
    </div>
  );
}
