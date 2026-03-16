import TextImageContent from "./TextImageContent";

export default function AboutLayout() {
  return (
    <div style={{ background: "var(--dark-bg)", "min-height": "100vh" }} class="flex flex-col">
      {/* Section 1: About the Saint Framework Hero */}
      <div class="pt-24 sm:pt-32 pb-16 sm:pb-20">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div class="text-center mb-12">
            <h1
              class="text-4xl sm:text-5xl md:text-6xl font-bold mb-6"
              style={{ "font-family": "'Goldman', sans-serif" }}
            >
              About the{" "}
              <span class="gold-gradient-text">Saint Framework</span>
            </h1>
            <p class="text-lg sm:text-xl max-w-3xl mx-auto" style={{ color: "var(--text-gray)" }}>
              Discover the revolutionary technology that's transforming text-based gaming through
              artificial intelligence, immersive storytelling, and cutting-edge narrative design.
            </p>
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
      <div style={{ background: "var(--dark-bg)" }} class="py-16 sm:py-20">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <h2
            class="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-16"
            style={{ "font-family": "'Goldman', sans-serif" }}
          >
            What the Saint Framework <span class="gold-gradient-text">Offers</span>
          </h2>

          {/* Features Grid */}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Adaptive AI Narratives */}
            <div
              class="backdrop-blur-sm p-6"
              style={{
                background: "rgba(13, 21, 37, 0.72)",
                border: "1px solid rgba(245, 197, 24, 0.12)",
                "border-radius": "20px",
                "box-shadow": "0 4px 40px rgba(0,0,0,0.35)",
              }}
            >
              <div
                class="rounded-full w-16 h-16 flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, var(--gold-light), var(--gold-primary))",
                }}
              >
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white mb-3" style={{ "font-family": "'Goldman', sans-serif" }}>Adaptive AI Narratives</h3>
              <p style={{ color: "var(--text-gray)" }}>
                Our advanced AI system learns from your choices, creating personalized storylines that evolve based on your playing style and preferences.
              </p>
            </div>

            {/* Infinite Story Possibilities */}
            <div
              class="backdrop-blur-sm p-6"
              style={{
                background: "rgba(13, 21, 37, 0.72)",
                border: "1px solid rgba(245, 197, 24, 0.12)",
                "border-radius": "20px",
                "box-shadow": "0 4px 40px rgba(0,0,0,0.35)",
              }}
            >
              <div
                class="rounded-full w-16 h-16 flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, var(--gold-light), var(--gold-primary))",
                }}
              >
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white mb-3" style={{ "font-family": "'Goldman', sans-serif" }}>Infinite Story Possibilities</h3>
              <p style={{ color: "var(--text-gray)" }}>
                Experience unlimited replayability with procedurally generated content that ensures no two playthroughs are ever the same.
              </p>
            </div>

            {/* Collaborative Intelligence */}
            <div
              class="backdrop-blur-sm p-6"
              style={{
                background: "rgba(13, 21, 37, 0.72)",
                border: "1px solid rgba(245, 197, 24, 0.12)",
                "border-radius": "20px",
                "box-shadow": "0 4px 40px rgba(0,0,0,0.35)",
              }}
            >
              <div
                class="rounded-full w-16 h-16 flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, var(--gold-light), var(--gold-primary))",
                }}
              >
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white mb-3" style={{ "font-family": "'Goldman', sans-serif" }}>Collaborative Intelligence</h3>
              <p style={{ color: "var(--text-gray)" }}>
                Leverage swarm intelligence where multiple AI agents work together to create rich, interconnected narrative experiences.
              </p>
            </div>

            {/* Dynamic World Building */}
            <div
              class="backdrop-blur-sm p-6"
              style={{
                background: "rgba(13, 21, 37, 0.72)",
                border: "1px solid rgba(245, 197, 24, 0.12)",
                "border-radius": "20px",
                "box-shadow": "0 4px 40px rgba(0,0,0,0.35)",
              }}
            >
              <div
                class="rounded-full w-16 h-16 flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, var(--gold-light), var(--gold-primary))",
                }}
              >
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white mb-3" style={{ "font-family": "'Goldman', sans-serif" }}>Dynamic World Building</h3>
              <p style={{ color: "var(--text-gray)" }}>
                Worlds that evolve and respond to player actions, creating living, breathing environments that feel truly alive.
              </p>
            </div>

            {/* Creator Tools */}
            <div
              class="backdrop-blur-sm p-6"
              style={{
                background: "rgba(13, 21, 37, 0.72)",
                border: "1px solid rgba(245, 197, 24, 0.12)",
                "border-radius": "20px",
                "box-shadow": "0 4px 40px rgba(0,0,0,0.35)",
              }}
            >
              <div
                class="rounded-full w-16 h-16 flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, var(--gold-light), var(--gold-primary))",
                }}
              >
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-white mb-3" style={{ "font-family": "'Goldman', sans-serif" }}>Creator Tools</h3>
              <p style={{ color: "var(--text-gray)" }}>
                Powerful, intuitive tools for creators to build, customize, and share their own narrative experiences.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Solomonic Artificially-Intelligent Narrative Technology */}
      <div style={{ background: "var(--dark-bg)" }} class="py-16 sm:py-20">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <h2
            class="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-16"
            style={{ "font-family": "'Goldman', sans-serif" }}
          >
            <span class="gold-gradient-text">Solomonic Artificially-Intelligent</span>{" "}
            <span class="gold-gradient-text">Narrative Technology</span>
          </h2>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Feature List */}
            <div class="space-y-8">
              <div class="flex items-start gap-4">
                <div
                  class="rounded-full p-3 flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--gold-light), var(--gold-primary))",
                  }}
                >
                  <span class="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2" style={{ "font-family": "'Goldman', sans-serif" }}>Solomonic Wisdom</h3>
                  <p style={{ color: "var(--text-gray)" }}>
                    Ancient decision-making principles applied to modern AI systems for balanced, thoughtful narrative choices.
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div
                  class="rounded-full p-3 flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--gold-light), var(--gold-primary))",
                  }}
                >
                  <span class="text-white font-bold text-lg">A</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2" style={{ "font-family": "'Goldman', sans-serif" }}>Artificial Intelligence</h3>
                  <p style={{ color: "var(--text-gray)" }}>
                    Advanced machine learning models trained on vast libraries of literature and storytelling techniques.
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div
                  class="rounded-full p-3 flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--gold-light), var(--gold-primary))",
                  }}
                >
                  <span class="text-white font-bold text-lg">I</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2" style={{ "font-family": "'Goldman', sans-serif" }}>Intelligent Systems</h3>
                  <p style={{ color: "var(--text-gray)" }}>
                    Self-learning algorithms that continuously improve story generation based on player feedback and engagement.
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div
                  class="rounded-full p-3 flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--gold-light), var(--gold-primary))",
                  }}
                >
                  <span class="text-white font-bold text-lg">N</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2" style={{ "font-family": "'Goldman', sans-serif" }}>Narrative Architecture</h3>
                  <p style={{ color: "var(--text-gray)" }}>
                    Sophisticated story structures that maintain coherence while allowing for infinite branching possibilities.
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div
                  class="rounded-full p-3 flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--gold-light), var(--gold-primary))",
                  }}
                >
                  <span class="text-white font-bold text-lg">T</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2" style={{ "font-family": "'Goldman', sans-serif" }}>Technological Innovation</h3>
                  <p style={{ color: "var(--text-gray)" }}>
                    Cutting-edge implementation pushing the boundaries of what's possible in interactive storytelling.
                  </p>
                </div>
              </div>
            </div>

            {/* AI Network Image Placeholder */}
            <div
              class="relative overflow-hidden shadow-2xl aspect-square flex items-center justify-center"
              style={{
                "border-radius": "20px",
                background: "rgba(13, 21, 37, 0.72)",
                border: "1px solid rgba(245, 197, 24, 0.12)",
                "box-shadow": "0 4px 40px rgba(0,0,0,0.35)",
              }}
            >
              <div
                class="absolute inset-0"
                style={{
                  background: "linear-gradient(135deg, rgba(245,197,24,0.06) 0%, transparent 60%)",
                  "border-radius": "20px",
                }}
              />
              <div class="text-center p-8 relative z-10">
                <svg
                  class="w-32 h-32 mx-auto mb-4"
                  fill="none"
                  stroke="rgba(245,197,24,0.35)"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <p class="text-sm" style={{ color: "rgba(245,197,24,0.38)" }}>AI Network Visualization</p>
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
      <div class="py-16 sm:py-20" style={{ background: "var(--dark-bg)" }}>
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div class="text-center mb-12">
            <h2
              class="text-3xl sm:text-4xl md:text-5xl font-bold mb-6"
              style={{ "font-family": "'Goldman', sans-serif" }}
            >
              Dive Deeper into the{" "}
              <span class="gold-gradient-text">Technology</span>
            </h2>
            <p class="text-lg max-w-3xl mx-auto" style={{ color: "var(--text-gray)" }}>
              Get comprehensive insights into our revolutionary framework with detailed technical specifications,
              implementation strategies, and future roadmap.
            </p>
          </div>

          {/* Whitepaper Card */}
          <div
            class="backdrop-blur-sm p-8 sm:p-10 max-w-4xl mx-auto"
            style={{
              background: "rgba(13, 21, 37, 0.72)",
              border: "1px solid rgba(245, 197, 24, 0.12)",
              "border-radius": "20px",
              "box-shadow": "0 4px 40px rgba(0,0,0,0.35)",
            }}
          >
            <h3
              class="text-2xl sm:text-3xl font-bold text-white mb-4 text-center"
              style={{ "font-family": "'Goldman', sans-serif" }}
            >
              Saint Framework Whitepaper
            </h3>
            <p class="text-center mb-8" style={{ color: "var(--text-gray)" }}>
              A comprehensive 50-page technical document covering AI architecture, narrative algorithms, swarm intelligence
              implementation, and real-world applications.
            </p>

            {/* Features Grid */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div class="flex flex-col items-center text-center">
                <div
                  class="rounded-full p-4 mb-3"
                  style={{ background: "rgba(245, 197, 24, 0.15)" }}
                >
                  <svg class="w-8 h-8" fill="none" stroke="var(--gold-primary)" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span class="font-medium" style={{ color: "var(--text-gray)" }}>Technical Specifications</span>
              </div>

              <div class="flex flex-col items-center text-center">
                <div
                  class="rounded-full p-4 mb-3"
                  style={{ background: "rgba(245, 197, 24, 0.15)" }}
                >
                  <svg class="w-8 h-8" fill="none" stroke="var(--gold-primary)" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <span class="font-medium" style={{ color: "var(--text-gray)" }}>Implementation Guide</span>
              </div>

              <div class="flex flex-col items-center text-center">
                <div
                  class="rounded-full p-4 mb-3"
                  style={{ background: "rgba(245, 197, 24, 0.15)" }}
                >
                  <svg class="w-8 h-8" fill="none" stroke="var(--gold-primary)" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span class="font-medium" style={{ color: "var(--text-gray)" }}>Future Roadmap</span>
              </div>
            </div>

            {/* Download Button */}
            <div class="text-center">
              <button class="btn-gold inline-flex items-center px-10 py-4 rounded-full text-lg font-bold">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Whitepaper
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}