import { createSignal, For } from 'solid-js';

interface Review {
    id: number;
    playerName: string;
    rating: number;
    reviewText: string;
    date: string;
}

export default function Reviews() {
    const [reviews] = createSignal<Review[]>([
        {
            id: 1,
            playerName: 'AlexTheGamer',
            rating: 4.5,
            reviewText: 'Incredible graphics and a truly immersive world. The swarm mechanics add a layer of complexity I haven\'t seen in an MMO before. Highly recommend giving it a try if you\'re a sci-fi fan.',
            date: '2 days ago'
        },
        {
            id: 2,
            playerName: 'Sarah_Nova',
            rating: 4,
            reviewText: 'Good game overall, but the early progression feels a bit slow. Once you get past level 20, things really open up. The community is surprisingly helpful too.',
            date: '5 days ago'
        },
        {
            id: 3,
            playerName: 'CyberPilot_X',
            rating: 5,
            reviewText: 'Best space MMO I\'ve played in years. The ship customization is deep and the combat feels satisfying. The neon aesthetic is absolutely stunning.',
            date: '1 week ago'
        }
    ]);

    const renderStars = (rating: number) => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars.push(
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="star filled">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                );
            } else if (i === fullStars && hasHalfStar) {
                stars.push(
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="star half">
                        <defs>
                            <linearGradient id={`half-${rating}`}>
                                <stop offset="50%" stop-color="currentColor" />
                                <stop offset="50%" stop-color="transparent" />
                            </linearGradient>
                        </defs>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#half-${rating})`} stroke="currentColor" stroke-width="1" />
                    </svg>
                );
            } else {
                stars.push(
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="star empty">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-width="2" />
                    </svg>
                );
            }
        }

        return stars;
    };

    return (
        <div class="reviews-container">
            <div class="reviews-header">
                <h2 class="reviews-title">USER REVIEWS</h2>
                <button class="add-review-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round" />
                    </svg>
                    Add Review
                </button>
            </div>

            <div class="reviews-list">
                <For each={reviews()}>
                    {(review) => (
                        <div class="review-card">
                            <div class="review-header">
                                <div class="player-info">
                                    <div class="player-avatar">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </div>
                                    <div class="player-details">
                                        <div class="player-name">{review.playerName}</div>
                                        <div class="player-rating">
                                            {renderStars(review.rating)}
                                        </div>
                                    </div>
                                </div>
                                <div class="review-date">{review.date}</div>
                            </div>
                            <p class="review-text">{review.reviewText}</p>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}