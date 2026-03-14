"use client";

import { createSignal, For, Show, onMount } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { useAuth } from "~/libs/AuthProvider";
import MemberLevel from "./MemberLevel";
import JoinForm from "./JoinForm";
import type { PlayerTier } from "~/libs/auth";

// ── Tier config ────────────────────────────────────────────────────────────

interface TierConfig {
  id: PlayerTier;
  title: string;
  price: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  isComingSoon?: boolean;
}

const TIERS: TierConfig[] = [
  {
    id: "free",
    title: "Free Tier",
    price: "$0",
    description: "Perfect for trying out the Saint Framework",
    features: [
      "Access to the Play marketplace",
      "Limited game experience",
      "Community access",
      "Basic profile features",
      "Full price for paid games",
    ],
  },
  {
    id: "pro",
    title: "Pro Tier",
    price: "$24.99",
    description: "For creators who want to build their own games",
    features: [
      "Everything in Free tier",
      "Access to free games",
      "Create up to 5 games per month",
      "Advanced game editor",
      "50% off all paid games",
      "Priority support",
    ],
    isPopular: true,
  },
  {
    id: "builder",
    title: "Builder Tier",
    price: "$49.99",
    description: "For professional developers and marketplace creators",
    features: [
      "Everything in Pro tier",
      "Unlimited game creation",
      "Monetize your games",
      "Create paid plugins",
      "Create paid themes",
      "Marketplace revenue sharing",
      "Advanced analytics",
    ],
    isComingSoon: true,
  },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function JoinLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect already-logged-in users away
  onMount(() => {
    if (!isLoading() && isAuthenticated()) {
      navigate("/play", { replace: true });
    }
  });

  const [selectedTier, setSelectedTier] = createSignal<PlayerTier>("free");

  const currentTierConfig = () => TIERS.find((t) => t.id === selectedTier())!;

  return (
    <div class="min-h-screen flex flex-col" style="background-color: #080c14;">
      {/* Hero */}
      <div class="pt-24 sm:pt-32 pb-12 sm:pb-16">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div class="text-center mb-12 sm:mb-16">
            <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
              Join the{" "}
              <span class="bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-600 bg-clip-text text-transparent">
                Adventure
              </span>
            </h1>
            <p class="text-slate-300 text-lg sm:text-xl max-w-3xl mx-auto">
              Create your profile and choose the perfect tier for your gaming
              journey
            </p>
          </div>

          {/* Two-column grid */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 sm:mb-20">
            {/* Left — tier selection */}
            <div>
              <h2 class="text-3xl font-bold text-white mb-8">
                Choose Your Tier
              </h2>
              <div class="space-y-6">
                <For each={TIERS}>
                  {(tier) => (
                    <MemberLevel
                      tier={tier}
                      isSelected={selectedTier() === tier.id}
                      onSelect={() =>
                        !tier.isComingSoon && setSelectedTier(tier.id)
                      }
                    />
                  )}
                </For>
              </div>
            </div>

            {/* Right — form (sticky) */}
            <div class="lg:sticky lg:top-24 lg:self-start">
              <JoinForm
                selectedTier={selectedTier()}
                tierLabel={currentTierConfig().title}
                tierPrice={currentTierConfig().price}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}