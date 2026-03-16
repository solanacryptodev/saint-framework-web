"use client";

// src/components/CreateLayout.tsx
// Rendered at /create
//
// Step 1 of the World Forge pipeline — upload stage.
// ForgeProvider is mounted in src/routes/create.tsx (the layout),
// NOT here, so state survives the navigation to /create/forge.
//
// What's collected here:
//   worldName    — required, creates the game record
//   worldTagline — optional
//   coverImage   — optional image upload
//   loreBible    — .md file that triggers startForge()
//
// Everything else (description, genre, cost_tier, cost) is parsed
// from ## Game Info in the lore bible by the ingestion agent.

import { createSignal, Show } from "solid-js";
import CreationCard from "./CreationCard";
import { useForge } from "./world-forge/ForgeContext";

export default function CreateLayout() {
  const forge = useForge();
  const [isDragging, setIsDragging] = createSignal(false);
  const [coverPreview, setCoverPreview] = createSignal<string | null>(null);

  let fileInputRef: HTMLInputElement | undefined;
  let coverInputRef: HTMLInputElement | undefined;

  // ── Lore bible handling ──────────────────────────────────────────────────

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith(".md")) {
      alert("Only markdown (.md) files are allowed.");
      return;
    }
    forge.startForge(file);
  };

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── Cover image handling ─────────────────────────────────────────────────

  const handleCoverImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      forge.setCoverImage(base64);
      setCoverPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div class="min-h-screen flex flex-col" style="background-color: #080c14;">
      <div class="flex-1 flex flex-col">
        <div class="pt-24 sm:pt-32 pb-16 sm:pb-20">
          <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">

            {/* Title */}
            <div class="text-center mb-16 sm:mb-20">
              <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
                Create Your{" "}
                <span class="bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-600 bg-clip-text text-transparent">
                  Universe
                </span>
              </h1>
              <p class="text-slate-300 text-lg sm:text-xl max-w-3xl mx-auto">
                Choose your creation path and bring your imagination to life with the Saint Framework
              </p>
            </div>

            {/* World metadata inputs */}
            <div class="max-w-2xl mx-auto mb-12">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-2">World Title</label>
                  <input
                    type="text"
                    value={forge.worldName()}
                    onInput={e => forge.setWorldName((e.target as HTMLInputElement).value)}
                    class="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    placeholder="My World"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-2">Tagline</label>
                  <input
                    type="text"
                    value={forge.worldTagline()}
                    onInput={e => forge.setWorldTagline((e.target as HTMLInputElement).value)}
                    class="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    placeholder="A brief description..."
                  />
                </div>
              </div>

              {/* Cover image */}
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Cover Image <span class="text-slate-500 font-normal">(optional)</span>
                </label>
                <div
                  onClick={() => coverInputRef?.click()}
                  class="flex items-center gap-4 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:border-yellow-500/50 transition-colors"
                >
                  <Show
                    when={coverPreview()}
                    fallback={
                      <div class="w-12 h-12 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-500 text-xl flex-shrink-0">
                        🖼
                      </div>
                    }
                  >
                    <img
                      src={coverPreview()!}
                      alt="Cover"
                      class="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  </Show>
                  <span class="text-slate-400 text-sm">
                    {coverPreview() ? "Change cover image" : "Upload a cover image…"}
                  </span>
                  <Show when={coverPreview()}>
                    <button
                      onClick={e => { e.stopPropagation(); forge.setCoverImage(null); setCoverPreview(null); }}
                      class="ml-auto text-slate-600 hover:text-slate-400 text-sm"
                    >
                      ✕
                    </button>
                  </Show>
                </div>
                <input
                  ref={el => coverInputRef = el}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleCoverImage(file);
                  }}
                />
              </div>

              {/* Upload error */}
              <Show when={forge.uploadError()}>
                <div class="mt-3 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {forge.uploadError()}
                </div>
              </Show>
            </div>

            {/* Creation cards */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 sm:mb-20">
              <CreationCard
                icon={
                  <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                title="Create Plugin"
                description="Extend functionality with custom plugins"
                isComingSoon={true}
              />
              <CreationCard
                icon={
                  <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                title="Create Game"
                description="Build immersive text-based adventures"
                isHighlighted={true}
                onClick={() => fileInputRef?.click()}
              />
              <CreationCard
                icon={
                  <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                }
                title="Create Theme"
                description="Design custom visual themes"
                isComingSoon={true}
              />
            </div>

            {/* CTA */}
            <div class="text-center mb-16 sm:mb-20">
              <p class="text-slate-300 text-lg mb-8">
                Ready to start building? Game creation is now available with our intuitive tools.
              </p>
              <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button class="bg-transparent border-2 border-yellow-500 hover:bg-yellow-500/10 text-yellow-400 font-semibold px-8 py-3 rounded-full text-lg transition-all duration-300">
                  View Documentation
                </button>
                <button class="bg-transparent border-2 border-yellow-600 hover:bg-yellow-600/10 text-yellow-500 font-semibold px-8 py-3 rounded-full text-lg transition-all duration-300">
                  Browse Examples
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Hidden lore bible file input */}
      <input
        ref={el => fileInputRef = el}
        type="file"
        accept=".md"
        style={{ display: "none" }}
        onChange={e => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) handleFileSelect(file);
        }}
      />

      {/* Drag-over overlay */}
      <Show when={isDragging()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center"
          style="background: rgba(8, 12, 20, 0.9);"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div class="text-center">
            <div class="text-6xl mb-4">📜</div>
            <div class="text-2xl font-bold text-white mb-2">Drop your lore bible here</div>
            <div class="text-slate-400">.md files only</div>
          </div>
        </div>
      </Show>
    </div>
  );
}