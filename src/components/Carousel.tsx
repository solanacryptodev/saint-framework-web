import { createSignal, onCleanup, onMount } from 'solid-js';
import './Carousel.css';

interface CarouselSlide {
  title: string;
  description: string;
  players: string;
  swarmSize: string;
}

const carouselSlides: CarouselSlide[] = [
  {
    title: "Mystic Realms: The Awakening",
    description: "Embark on an epic fantasy adventure in a world where magic and mystery collide.",
    players: "1,247 players",
    swarmSize: "150 swarm"
  },
  {
    title: "Cyber Chronicles 2087",
    description: "Navigate a neon-lit dystopian future where technology and humanity clash.",
    players: "892 players",
    swarmSize: "200 swarm"
  },
  {
    title: "Quantum Mysteries",
    description: "Solve mind-bending puzzles in a world governed by quantum mechanics.",
    players: "534 players",
    swarmSize: "75 swarm"
  }
];

export default function Carousel() {
  const [currentSlide, setCurrentSlide] = createSignal(0);
  let intervalId: number | undefined;

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  onMount(() => {
    intervalId = window.setInterval(() => {
      nextSlide();
    }, 5000);
  });

  onCleanup(() => {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }
  });

  return (
    <div class="carousel">
      <div class="carousel-container">
        <div 
          class="carousel-track"
          style={`transform: translateX(-${currentSlide() * 100}%)`}
        >
          {carouselSlides.map((slide, index) => (
            <div class="carousel-slide">
              <div class="carousel-image">
                {/* Placeholder gradient background */}
                <div class="placeholder-gradient"></div>
              </div>
              <div class="carousel-content">
                <h2 class="carousel-title">{slide.title}</h2>
                <p class="carousel-description">{slide.description}</p>
                <div class="carousel-stats">
                  <span class="stat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="12" cy="7" r="4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    {slide.players}
                  </span>
                  <span class="stat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    {slide.swarmSize}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button 
          class="carousel-btn carousel-prev"
          onClick={prevSlide}
          aria-label="Previous slide"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M15 18l-6-6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <button 
          class="carousel-btn carousel-next"
          onClick={nextSlide}
          aria-label="Next slide"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 18l6-6-6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <div class="carousel-indicators">
        {carouselSlides.map((_, index) => (
          <button
            class={`indicator ${currentSlide() === index ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
