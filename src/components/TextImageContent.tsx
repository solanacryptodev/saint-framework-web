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
  const bgColor = props.darkBackground ? "bg-slate-800" : "bg-slate-900";
  const textOrder = props.textOnRight ? "lg:order-2" : "lg:order-1";
  const imageOrder = props.textOnRight ? "lg:order-1" : "lg:order-2";

  return (
    <div class={`${bgColor} py-16 sm:py-20 lg:py-24`}>
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Text Content */}
          <div class={`${textOrder}`}>
            {props.subtitle && (
              <h3 class="text-purple-400 text-lg font-semibold mb-2">
                {props.subtitle}
              </h3>
            )}
            {props.title && (
              <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                {props.title}
              </h2>
            )}
            <div class="text-slate-300 text-base sm:text-lg leading-relaxed mb-6">
              {props.content}
            </div>
            {props.features && props.features.length > 0 && (
              <ul class="space-y-3">
                {props.features.map((feature) => (
                  <li class="flex items-start">
                    <svg
                      class="w-6 h-6 text-purple-400 mr-3 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span class="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Image */}
          <div class={`${imageOrder}`}>
            {props.imageSrc ? (
              <div class="relative rounded-lg overflow-hidden shadow-2xl">
                <img
                  src={props.imageSrc}
                  alt={props.imageAlt || "Content image"}
                  class="w-full h-auto"
                />
              </div>
            ) : (
              <div class="relative rounded-lg overflow-hidden shadow-2xl bg-slate-700 aspect-video flex items-center justify-center">
                <div class="text-slate-500 text-center p-8">
                  <svg
                    class="w-24 h-24 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p class="text-sm">Image placeholder</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextImageContent;
