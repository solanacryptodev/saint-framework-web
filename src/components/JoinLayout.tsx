import { createSignal } from "solid-js";
import MemberLevel from "./MemberLevel";
import JoinForm from "./JoinForm";
import Footer from "./Footer";

export default function JoinLayout() {
  const [selectedTier, setSelectedTier] = createSignal("Free Tier");

  return (
    <div class="bg-slate-900 min-h-screen flex flex-col">
      {/* Main Content */}
      <div class="flex-1 flex flex-col">
        {/* Hero Section */}
        <div class="pt-24 sm:pt-32 pb-12 sm:pb-16">
          <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
            <div class="text-center mb-12 sm:mb-16">
              <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
                Join the{" "}
                <span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Adventure
                </span>
              </h1>
              <p class="text-slate-300 text-lg sm:text-xl max-w-3xl mx-auto">
                Create your profile and choose the perfect tier for your gaming journey
              </p>
            </div>

            {/* Main Content Grid */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 sm:mb-20">
              {/* Left Column - Membership Tiers */}
              <div>
                <h2 class="text-3xl font-bold text-white mb-8">Choose Your Tier</h2>
                <div class="space-y-6">
                  {/* Free Tier */}
                  <MemberLevel
                    title="Free Tier"
                    price="$0"
                    description="Perfect for trying out the Saint Framework"
                    features={[
                      "Access to the Play marketplace",
                      "Limited game experience",
                      "Community access",
                      "Basic profile features",
                      "Full price for paid games"
                    ]}
                    isSelected={selectedTier() === "Free Tier"}
                    onSelect={() => setSelectedTier("Free Tier")}
                  />

                  {/* Pro Tier */}
                  <MemberLevel
                    title="Pro Tier"
                    price="$24.99"
                    description="For creators who want to build their own games"
                    features={[
                      "Everything in Free tier",
                      "Access to free games",
                      "Create up to 5 games per month",
                      "Advanced game editor",
                      "50% off all paid games",
                      "Priority support"
                    ]}
                    isPopular={true}
                    isSelected={selectedTier() === "Pro Tier"}
                    onSelect={() => setSelectedTier("Pro Tier")}
                  />

                  {/* Builder Tier */}
                  <MemberLevel
                    title="Builder Tier"
                    price="$49.99"
                    description="For professional developers and marketplace creators"
                    features={[
                      "Everything in Pro tier",
                      "Unlimited game creation",
                      "Monetize your games",
                      "Create paid plugins",
                      "Create paid themes",
                      "Marketplace revenue sharing",
                      "Advanced analytics"
                    ]}
                    isComingSoon={true}
                    isSelected={selectedTier() === "Builder Tier"}
                    onSelect={() => setSelectedTier("Builder Tier")}
                  />
                </div>
              </div>

              {/* Right Column - Form */}
              <div class="lg:sticky lg:top-24 lg:self-start">
                <JoinForm selectedTier={selectedTier} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
