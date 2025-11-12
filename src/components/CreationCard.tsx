import { Component, JSX } from "solid-js";

interface CreationCardProps {
  icon: JSX.Element;
  title: string;
  description: string;
  isComingSoon?: boolean;
  isHighlighted?: boolean;
}

const CreationCard: Component<CreationCardProps> = (props) => {
  return (
    <div class={`relative rounded-2xl border-2 p-8 transition-all duration-300 hover:scale-105 ${
      props.isHighlighted 
        ? 'bg-gradient-to-br from-purple-600 to-pink-600 border-purple-400' 
        : 'bg-slate-800/50 border-slate-700 hover:border-purple-500'
    }`}>
      {props.isComingSoon && (
        <div class="absolute top-4 right-4 bg-yellow-500 text-slate-900 text-sm font-bold px-4 py-1 rounded-full">
          Coming Soon
        </div>
      )}
      
      <div class={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
        props.isHighlighted ? 'bg-white/20' : 'bg-slate-700/50'
      }`}>
        {props.icon}
      </div>
      
      <h3 class={`text-2xl font-bold mb-3 ${
        props.isHighlighted ? 'text-white' : 'text-slate-300'
      }`}>
        {props.title}
      </h3>
      
      <p class={props.isHighlighted ? 'text-white/90' : 'text-slate-400'}>
        {props.description}
      </p>
    </div>
  );
};

export default CreationCard;
