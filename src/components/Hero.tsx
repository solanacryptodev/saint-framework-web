import { Component } from "solid-js";

interface HeroProps {
  backgroundImage?: string;
}

const Hero: Component<HeroProps> = (props) => {
  return (
    <div class="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div
        class="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          "background-image": `url('/saint hero.png')`,
        }}
      >
        {/* Slight dark overlay */}
        <div class="absolute inset-0 bg-black/15" />

        {/* Dark overlay to make text readable */}
        <div
          class="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(8,12,20,0.45) 0%, rgba(8,12,20,0.2) 40%, rgba(8,12,20,0.7) 85%, rgba(8,12,20,1) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div class="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <h1
          class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-6 sm:mb-8"
          style={{ "font-family": "'Goldman', sans-serif" }}
        >
          <span class="text-white">The </span>
          <span class="gold-gradient-text">Saint Framework</span>
        </h1>

        <p class="text-base sm:text-lg md:text-xl lg:text-2xl text-slate-300 mb-8 sm:mb-12 font-light max-w-3xl mx-auto tracking-wide">
          Mythic Technology Powered by{" "}
          <span style={{ color: "#f5c518" }}>Swarm Intelligence</span>
        </p>

        <a
          href="/play"
          class="btn-gold inline-flex items-center gap-2 px-8 sm:px-10 py-3 sm:py-4 rounded-full text-base sm:text-lg font-bold"
        >
          Explore Games
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Bottom fade to dark */}
      <div
        class="absolute bottom-0 left-0 right-0 h-40"
        style={{
          background: "linear-gradient(to bottom, transparent, #080c14)",
        }}
      />
    </div>
  );
};

export default Hero;
