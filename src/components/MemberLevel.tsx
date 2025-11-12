import { For } from "solid-js";

interface MemberLevelProps {
  title: string;
  price: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  isComingSoon?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function MemberLevel(props: MemberLevelProps) {
  return (
    <div 
      class={`relative border-2 rounded-xl p-6 transition-all duration-300 ${
        props.isSelected 
          ? 'border-purple-400 bg-purple-900/20' 
          : 'border-slate-700 hover:border-purple-500/50'
      }`}
      onClick={props.onSelect}
      style={{ cursor: props.onSelect ? 'pointer' : 'default' }}
    >
      {/* Popular Badge */}
      {props.isPopular && (
        <div class="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span class="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold px-4 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Coming Soon Badge */}
      {props.isComingSoon && (
        <div class="absolute -top-3 right-6">
          <span class="bg-yellow-500 text-slate-900 text-sm font-semibold px-4 py-1 rounded-full">
            Coming Soon
          </span>
        </div>
      )}

      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            props.isSelected ? 'border-purple-400 bg-purple-400' : 'border-slate-500'
          }`}>
            {props.isSelected && (
              <div class="w-3 h-3 bg-white rounded-full"></div>
            )}
          </div>
          <h3 class="text-2xl font-bold text-white">{props.title}</h3>
        </div>
        <div class="text-3xl font-bold text-purple-400">{props.price}</div>
      </div>

      {/* Description */}
      <p class="text-slate-300 mb-6">{props.description}</p>

      {/* Features */}
      <ul class="space-y-3">
        <For each={props.features}>
          {(feature) => (
            <li class="flex items-start gap-3">
              <svg class="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-slate-300">{feature}</span>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
