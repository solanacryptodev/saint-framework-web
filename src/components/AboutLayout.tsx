import Footer from "./Footer";
import TextImageContent from "./TextImageContent";

export default function AboutLayout() {
  return (
    <div class="bg-slate-900 min-h-screen flex flex-col">
      {/* Section 1: About the Saint Framework Hero */}
      <div class="pt-24 sm:pt-32 pb-16 sm:pb-20">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div class="text-center mb-12">
            <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
              About the{" "}
              <span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Saint Framework
              </span>
            </h1>
            <p class="text-slate-300 text-lg sm:text-xl max-w-3xl mx-auto">
              Discover the revolutionary technology that's transforming text-based gaming through
              artificial intelligence, immersive storytelling, and cutting-edge narrative design.
            </p>
          </div>

          {/* Hero Image Placeholder */}
          <div class="relative rounded-lg overflow-hidden shadow-2xl bg-gradient-to-br from-purple-900/50 to-pink-900/50 aspect-video flex items-center justify-center mb-16">
            <div class="text-slate-400 text-center p-8">
              <svg
                class="w-32 h-32 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p class="text-sm">Brain Network Image Placeholder</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: What is the Saint Framework? */}
      <TextImageContent
        title="What is the Saint Framework?"
        content={
          <div>
            <p class="mb-4">
              The Saint Framework represents a paradigm shift in interactive entertainment, combining advanced
              artificial intelligence with immersive storytelling to create dynamic, personalized gaming experiences
              that adapt to each player's choices and preferences.
            </p>
            <p class="mb-4">
              Built on the foundation of Solomonic wisdom and powered by swarm intelligence, our framework generates
              infinite narrative possibilities while maintaining coherent, engaging storylines that respond to player
              agency.
            </p>
            <p>
              Whether you're exploring vast fantasy realms, unraveling cosmic mysteries, or navigating complex moral
              dilemmas, the Saint Framework ensures every journey is uniquely yours.
            </p>
          </div>
        }
        textOnRight={false}
        darkBackground={true}
      />

      {/* Section 3: What the Saint Framework Offers */}
      <div class="bg-slate-800 py-16 sm:py-20">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <h2 class="text-3xl sm:text-4xl md:text-5xl font-bold text-white text-center mb-16">
            What the Saint Framework Offers
          </h2>

          {/* Features Grid */}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Adaptive AI Narratives */}
            <div class="bg-slate-900/50 border border-slate-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors">
              <div class="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white mb-3">Adaptive AI Narratives</h3>
              <p class="text-slate-300">
                Our advanced AI system learns from your choices, creating personalized storylines that evolve based on your playing style and preferences.
              </p>
            </div>

            {/* Infinite Story Possibilities */}
            <div class="bg-slate-900/50 border border-slate-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors">
              <div class="bg-gradient-to-br from-blue-500 to-purple-500 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white mb-3">Infinite Story Possibilities</h3>
              <p class="text-slate-300">
                Experience unlimited replayability with procedurally generated content that ensures no two playthroughs are ever the same.
              </p>
            </div>

            {/* Collaborative Intelligence */}
            <div class="bg-slate-900/50 border border-slate-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors">
              <div class="bg-gradient-to-br from-pink-500 to-purple-500 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white mb-3">Collaborative Intelligence</h3>
              <p class="text-slate-300">
                Leverage swarm intelligence where multiple AI agents work together to create rich, interconnected narrative experiences.
              </p>
            </div>

            {/* Dynamic World Building */}
            <div class="bg-slate-900/50 border border-slate-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors">
              <div class="bg-gradient-to-br from-blue-500 to-purple-500 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white mb-3">Dynamic World Building</h3>
              <p class="text-slate-300">
                Worlds that evolve and respond to player actions, creating living, breathing environments that feel truly alive.
              </p>
            </div>

            {/* Creator Tools */}
            <div class="bg-slate-900/50 border border-slate-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors">
              <div class="bg-gradient-to-br from-pink-500 to-purple-500 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white mb-3">Creator Tools</h3>
              <p class="text-slate-300">
                Powerful, intuitive tools for creators to build, customize, and share their own narrative experiences.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Solomonic Artificially-Intelligent Narrative Technology */}
      <div class="bg-slate-900 py-16 sm:py-20">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <h2 class="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-16">
            <span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Solomonic Artificially-Intelligent
            </span>{" "}
            <span class="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              Narrative Technology
            </span>
          </h2>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Feature List */}
            <div class="space-y-8">
              <div class="flex items-start gap-4">
                <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-full p-3 flex-shrink-0">
                  <span class="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2">Solomonic Wisdom</h3>
                  <p class="text-slate-300">
                    Ancient decision-making principles applied to modern AI systems for balanced, thoughtful narrative choices.
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div class="bg-gradient-to-br from-pink-500 to-pink-600 rounded-full p-3 flex-shrink-0">
                  <span class="text-white font-bold text-lg">A</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2">Artificial Intelligence</h3>
                  <p class="text-slate-300">
                    Advanced machine learning models trained on vast libraries of literature and storytelling techniques.
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-3 flex-shrink-0">
                  <span class="text-white font-bold text-lg">I</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2">Intelligent Systems</h3>
                  <p class="text-slate-300">
                    Self-learning algorithms that continuously improve story generation based on player feedback and engagement.
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-full p-3 flex-shrink-0">
                  <span class="text-white font-bold text-lg">N</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2">Narrative Architecture</h3>
                  <p class="text-slate-300">
                    Sophisticated story structures that maintain coherence while allowing for infinite branching possibilities.
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div class="bg-gradient-to-br from-pink-500 to-pink-600 rounded-full p-3 flex-shrink-0">
                  <span class="text-white font-bold text-lg">T</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2">Technological Innovation</h3>
                  <p class="text-slate-300">
                    Cutting-edge implementation pushing the boundaries of what's possible in interactive storytelling.
                  </p>
                </div>
              </div>
            </div>

            {/* AI Network Image Placeholder */}
            <div class="relative rounded-lg overflow-hidden shadow-2xl bg-gradient-to-br from-purple-900/50 to-pink-900/50 aspect-square flex items-center justify-center">
              <div class="text-slate-400 text-center p-8">
                <svg
                  class="w-32 h-32 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <p class="text-sm">AI Network Image Placeholder</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Core Philosophy */}
      <TextImageContent
        title="Core Philosophy"
        content={
          <div>
            <p class="mb-4">
              Every story should be as unique as the person experiencing it. Through AI-driven narrative generation,
              we create worlds that live, breathe, and evolve with each decision.
            </p>
            <p>
              Our framework represents a paradigm shift in how stories are told, combining ancient wisdom with
              cutting-edge technology to deliver experiences that are both deeply personal and infinitely varied.
            </p>
          </div>
        }
        textOnRight={true}
        darkBackground={false}
      />

      {/* Section 6: Dive Deeper into the Technology */}
      <div class="bg-gradient-to-br from-purple-900/30 to-blue-900/30 py-16 sm:py-20">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div class="text-center mb-12">
            <h2 class="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
              Dive Deeper into the{" "}
              <span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Technology
              </span>
            </h2>
            <p class="text-slate-300 text-lg max-w-3xl mx-auto">
              Get comprehensive insights into our revolutionary framework with detailed technical specifications,
              implementation strategies, and future roadmap.
            </p>
          </div>

          {/* Whitepaper Card */}
          <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-8 sm:p-10 max-w-4xl mx-auto">
            <h3 class="text-2xl sm:text-3xl font-bold text-white mb-4 text-center">
              Saint Framework Whitepaper
            </h3>
            <p class="text-slate-300 text-center mb-8">
              A comprehensive 50-page technical document covering AI architecture, narrative algorithms, swarm intelligence
              implementation, and real-world applications.
            </p>

            {/* Features Grid */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div class="flex flex-col items-center text-center">
                <div class="bg-purple-500/20 rounded-full p-4 mb-3">
                  <svg class="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span class="text-slate-300 font-medium">Technical Specifications</span>
              </div>

              <div class="flex flex-col items-center text-center">
                <div class="bg-purple-500/20 rounded-full p-4 mb-3">
                  <svg class="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <span class="text-slate-300 font-medium">Implementation Guide</span>
              </div>

              <div class="flex flex-col items-center text-center">
                <div class="bg-pink-500/20 rounded-full p-4 mb-3">
                  <svg class="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span class="text-slate-300 font-medium">Future Roadmap</span>
              </div>
            </div>

            {/* Download Button */}
            <div class="text-center">
              <button class="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-10 py-4 rounded-full text-lg transition-all duration-300 shadow-lg hover:shadow-purple-500/50 flex items-center gap-2 mx-auto">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Whitepaper
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
