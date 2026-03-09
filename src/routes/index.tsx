import Hero from "~/components/Hero";
import TextImageContent from "~/components/TextImageContent";
import Footer from "~/components/Footer";

export default function Home() {
  return (
    <main style={{ background: "var(--dark-bg)" }}>
      {/* Hero Section — negative margin pulls it behind the floating nav */}
      <div style={{ "margin-top": "-72px" }}>
        <Hero />
      </div>

      {/* SAINT Acronym Section */}
      <div
        class="py-12 sm:py-16"
        style={{
          background: "var(--dark-bg)",
        }}
      >
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight"
            style={{ "font-family": "'Goldman', sans-serif" }}
          >
            <span class="gold-gradient-text">S</span>
            <span class="text-white">olomonic </span>
            <span class="gold-gradient-text">A</span>
            <span class="text-white">rtificially-</span>
            <span class="gold-gradient-text">I</span>
            <span class="text-white">ntelligent </span>
            <span class="gold-gradient-text">N</span>
            <span class="text-white">arrative </span>
            <br class="hidden sm:block" />
            <span class="gold-gradient-text">T</span>
            <span class="text-white">echnology</span>
          </h2>
        </div>
      </div>

      {/* Immersive Storytelling Section */}
      <TextImageContent
        title="Immersive Storytelling"
        content={
          <p>
            Dive into rich, branching narratives where every choice matters. Our advanced
            text-based engine creates dynamic stories that adapt to your decisions,
            offering unlimited replayability and personalized adventures.
          </p>
        }
        features={[
          "Dynamic story branching",
          "Character progression system",
          "Multiple endings",
        ]}
        textOnRight={false}
        darkBackground={false}
      />

      {/* Cross-Platform Adventure Section */}
      <TextImageContent
        title="Cross-Platform Adventure"
        content={
          <p>
            Play seamlessly across all your devices. Start your adventure on desktop,
            continue on mobile, and pick up where you left off anywhere. Your progress
            syncs automatically across platforms.
          </p>
        }
        features={[
          "Mobile optimized",
          "Desktop experience",
          "Cloud save sync",
        ]}
        textOnRight={true}
        darkBackground={true}
      />

      {/* Community & Sharing Section */}
      <TextImageContent
        title="Community & Sharing"
        content={
          <p>
            Connect with fellow adventurers, share your achievements, and discover new
            stories created by the community. Join guilds, participate in events, and
            become part of the Saint Framework legend.
          </p>
        }
        features={[
          "Player communities",
          "Achievement system",
          "Story sharing",
        ]}
        textOnRight={false}
        darkBackground={false}
      />

      {/* Call to Action Section — glass card */}
      <div class="px-4 sm:px-6 lg:px-10 py-4 pb-8">
        <div
          class="backdrop-blur-sm"
          style={{
            background: "rgba(13, 21, 37, 0.72)",
            border: "1px solid rgba(245, 197, 24, 0.12)",
            "border-radius": "20px",
            "box-shadow": "0 4px 40px rgba(0,0,0,0.35)",
          }}
        >
          <div class="py-16 sm:py-20 lg:py-24 text-center px-4 sm:px-8">
            <h2
              class="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
              style={{ "font-family": "'Goldman', sans-serif" }}
            >
              Ready to Begin Your{" "}
              <span class="gold-gradient-text">Epic Journey</span>?
            </h2>
            <p
              class="text-lg sm:text-xl mb-10 max-w-2xl mx-auto"
              style={{ color: "var(--text-gray)" }}
            >
              Join thousands of players already exploring infinite worlds of adventure.
              Your story awaits.
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="/play"
                class="btn-gold inline-flex items-center px-8 py-3 rounded-full text-lg font-bold"
              >
                Start Playing Now
              </a>
              <button class="btn-ghost flex items-center gap-2 px-8 py-3 rounded-full text-lg font-medium">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </main>
  );
}
