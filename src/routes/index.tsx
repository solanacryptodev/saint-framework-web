import Hero from "~/components/Hero";
import TextImageContent from "~/components/TextImageContent";
import Footer from "~/components/Footer";

export default function Home() {
  return (
    <main class="bg-slate-900">
      {/* Hero Section */}
      <Hero />

      {/* Main Title Section */}
      <div class="bg-slate-800 py-12 sm:py-16">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            <span class="text-purple-400">S</span>
            <span class="text-white">olomonic </span>
            <span class="text-purple-400">A</span>
            <span class="text-white">rtificially-</span>
            <span class="text-purple-400">I</span>
            <span class="text-white">ntelligent </span>
            <span class="text-purple-400">N</span>
            <span class="text-white">arrative </span>
            <span class="text-purple-400">T</span>
            <span class="text-white">echnology</span>
          </h2>
        </div>
      </div>

      {/* Immersive Storytelling Section */}
      <TextImageContent
        title="Immersive Storytelling"
        content={
          <p>
            Dive into rich, branching narratives where every choice matters. Our advanced text-based engine creates dynamic stories that adapt to your decisions, offering unlimited replayability and personalized adventures.
          </p>
        }
        features={[
          "Dynamic story branching",
          "Character progression system",
          "Multiple endings"
        ]}
        textOnRight={false}
      />

      {/* Cross-Platform Adventure Section */}
      <TextImageContent
        title="Cross-Platform Adventure"
        content={
          <p>
            Play seamlessly across all your devices. Start your adventure on desktop, continue on mobile, and pick up where you left off anywhere. Your progress syncs automatically across platforms.
          </p>
        }
        features={[
          "Mobile optimized",
          "Desktop experience",
          "Cloud save sync"
        ]}
        textOnRight={true}
        darkBackground={true}
      />

      {/* Community & Sharing Section */}
      <TextImageContent
        title="Community & Sharing"
        content={
          <p>
            Connect with fellow adventurers, share your achievements, and discover new stories created by the community. Join guilds, participate in events, and become part of the Saint Framework legend.
          </p>
        }
        features={[
          "Player communities",
          "Achievement system",
          "Story sharing"
        ]}
        textOnRight={false}
      />

      {/* Call to Action Section */}
      <div class="bg-gradient-to-r from-purple-900 via-purple-800 to-blue-900 py-16 sm:py-20 lg:py-24">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 class="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Ready to Begin Your{" "}
            <span class="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              Epic Journey
            </span>
            ?
          </h2>
          <p class="text-slate-200 text-lg sm:text-xl mb-8 max-w-2xl mx-auto">
            Join thousands of players already exploring infinite worlds of adventure. Your story awaits.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button class="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-8 py-3 rounded-full text-lg transition-all duration-300 shadow-lg hover:shadow-purple-500/50 hover:scale-105">
              Start Playing Now
            </button>
            <button class="bg-transparent border-2 border-white hover:bg-white hover:text-purple-900 text-white font-semibold px-8 py-3 rounded-full text-lg transition-all duration-300">
              Watch Demo
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </main>
  );
}
