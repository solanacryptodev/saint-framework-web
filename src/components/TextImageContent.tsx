import { Component, JSX } from "solid-js";

interface TextImageContentProps {
  title?: string;
  subtitle?: string;
  content: JSX.Element | string;
  imageSrc?: string;
  imageAlt?: string;
  textOnRight?: boolean;
  features?: string[];
  darkBackground?: boolean;
}

const TextImageContent: Component<TextImageContentProps> = (props) => {
  const textOrder = props.textOnRight ? "lg:order-2" : "lg:order-1";
  const imageOrder = props.textOnRight ? "lg:order-1" : "lg:order-2";

  return (
    /* Outer spacing wrapper — keeps card floating off screen edges */
    <div class="px-4 sm:px-6 lg:px-10 py-4">
      {/* Glass card */}
      <div
        class="backdrop-blur-sm"
        style={{
          background: props.darkBackground
            ? "rgba(17, 27, 46, 0.72)"
            : "rgba(13, 21, 37, 0.72)",
          border: "1px solid rgba(245, 197, 24, 0.12)",
          "border-radius": "20px",
          "box-shadow": "0 4px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(245,197,24,0.04) inset",
        }}
      >
        <div class="container mx-auto px-6 sm:px-10 lg:px-14 py-14 sm:py-16 lg:py-20">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Text Content */}
            <div class={`${textOrder}`}>
              {props.subtitle && (
                <p class="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--gold-dim)" }}>
                  {props.subtitle}
                </p>
              )}
              {props.title && (
                <h2
                  class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 gold-gradient-text"
                  style={{ "font-family": "'Goldman', sans-serif" }}
                >
                  {props.title}
                </h2>
              )}
              <div class="text-slate-400 text-base sm:text-lg leading-relaxed mb-6">
                {props.content}
              </div>
              {props.features && props.features.length > 0 && (
                <ul class="space-y-3">
                  {props.features.map((feature) => (
                    <li class="flex items-center gap-3">
                      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="#f5c518" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      <span class="text-slate-300 text-sm sm:text-base">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Image */}
            <div class={`${imageOrder}`}>
              {props.imageSrc ? (
                <div
                  class="relative overflow-hidden shadow-2xl"
                  style={{
                    "border-radius": "14px",
                    border: "1px solid rgba(245,197,24,0.15)",
                  }}
                >
                  <img src={props.imageSrc} alt={props.imageAlt || "Content image"} class="w-full h-auto" />
                </div>
              ) : (
                /* Styled placeholder panel */
                <div
                  class="relative overflow-hidden shadow-2xl aspect-video flex items-center justify-center"
                  style={{
                    "border-radius": "14px",
                    background: "linear-gradient(135deg, rgba(13,21,37,0.9) 0%, rgba(17,27,46,0.9) 100%)",
                    border: "1px solid rgba(245,197,24,0.18)",
                  }}
                >
                  <div
                    class="absolute inset-0"
                    style={{
                      background: "linear-gradient(135deg, rgba(245,197,24,0.06) 0%, transparent 60%)",
                      "border-radius": "14px",
                    }}
                  />
                  <div class="text-center p-8 relative z-10">
                    <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="rgba(245,197,24,0.35)" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p class="text-sm" style={{ color: "rgba(245,197,24,0.38)" }}>Game Preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextImageContent;
