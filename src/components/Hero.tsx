import { Component } from "solid-js";

interface HeroProps {
  backgroundImage?: string;
}

const Hero: Component<HeroProps> = (props) => {
  return (
    <div class="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      {props.backgroundImage ? (
        <div
          class="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ "background-image": `url(${props.backgroundImage})` }}
        >
          <div class="absolute inset-0 bg-slate-900/50" />
        </div>
      ) : (
        // Gradient background as placeholder
        <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900">
          <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900 to-slate-900" />
        </div>
      )}

      {/* Content */}
      <div class="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-6 sm:mb-8">
          <span class="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            The Saint Framework
          </span>
        </h1>
        
        <p class="text-lg sm:text-xl md:text-2xl lg:text-3xl text-slate-200 mb-8 sm:mb-12 font-light max-w-3xl mx-auto">
          Mythic Technology Powered by Swarm Intelligence
        </p>
        
        <button class="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-8 sm:px-10 py-3 sm:py-4 rounded-full text-base sm:text-lg transition-all duration-300 shadow-lg hover:shadow-purple-500/50 hover:scale-105">
          Explore Games
        </button>
      </div>

      {/* Decorative elements */}
      <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent" />
    </div>
  );
};

export default Hero;
