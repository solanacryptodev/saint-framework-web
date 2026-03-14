import { For, Show } from "solid-js";
import type { PlayerTier } from "~/libs/auth";

interface TierConfig {
  id: PlayerTier;
  title: string;
  price: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  isComingSoon?: boolean;
}

interface MemberLevelProps {
  tier: TierConfig;
  isSelected: boolean;
  onSelect: () => void;
}

export default function MemberLevel(props: MemberLevelProps) {
  const t = props.tier;
  const selectedColor = !t.isComingSoon ? "border-yellow-500" : "border-purple-500";
  const selectedBg = !t.isComingSoon ? "bg-yellow-500/5" : "bg-purple-500/5";

  return (
    <button
      type="button"
      onClick={props.onSelect}
      disabled={t.isComingSoon}
      class={[
        "w-full text-left rounded-xl border p-6 transition-all duration-200 relative",
        "disabled:cursor-not-allowed disabled:opacity-60",
        props.isSelected
          ? `${selectedColor} ${selectedBg}`
          : "border-slate-700 bg-slate-800/30 hover:border-slate-500",
      ].join(" ")}
    >
      {/* Badges */}
      <Show when={t.isPopular}>
        <div class="absolute -top-3 left-1/2 -translate-x-1/2">
          <span class="bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      </Show>
      <Show when={t.isComingSoon}>
        <div class="absolute -top-3 right-4">
          <span class="bg-slate-600 text-slate-300 text-xs font-bold px-3 py-1 rounded-full">
            Coming Soon
          </span>
        </div>
      </Show>

      {/* Header */}
      <div class="flex justify-between items-start mb-3">
        <div>
          <h3 class="text-white font-bold text-xl">{t.title}</h3>
          <p class="text-slate-400 text-sm mt-1">{t.description}</p>
        </div>
        <div class="text-right ml-4 flex-shrink-0">
          <div class={`text-2xl font-bold ${!t.isComingSoon ? "text-yellow-400" : "text-white"}`}>
            {t.price}
          </div>
          <Show when={t.price !== "$0"}>
            <div class="text-slate-500 text-xs">/month</div>
          </Show>
        </div>
      </div>

      {/* Features */}
      <ul class="space-y-2">
        <For each={t.features}>
          {(feature) => (
            <li class="flex items-center gap-2 text-slate-300 text-sm">
              <span class={!t.isComingSoon ? "text-yellow-400" : "text-purple-400"}>✓</span>
              {feature}
            </li>
          )}
        </For>
      </ul>

      {/* Selection indicator */}
      <Show when={props.isSelected}>
        <div class={`mt-4 text-center text-sm font-semibold ${!t.isComingSoon ? "text-yellow-400" : "text-purple-400"}`}>
          ✦ Selected
        </div>
      </Show>
    </button>
  );
}