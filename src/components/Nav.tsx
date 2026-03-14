"use client";
// src/components/Nav.tsx
//
// Auth-aware navbar. Uses AuthProvider for login state.
// Shows pill with username when logged in (routes to /player).
// Opens SignInModal when Login button is clicked.

import { createSignal, Show, Switch, Match } from "solid-js";
import { useLocation, A } from "@solidjs/router";
import { useAuth } from "~/libs/AuthProvider";
import SignInModal from "./SignInModal";

export default function Nav() {
  const location = useLocation();
  const { isAuthenticated, isLoading, player } = useAuth();

  const active = (path: string) =>
    path === location.pathname
      ? "gold-gradient-text font-semibold"
      : "text-slate-300 hover:text-yellow-300 transition-colors";

  // ── Sign-in modal state ─────────────────────────────────────────────
  const [showModal, setShowModal] = createSignal(false);

  return (
    <>
      {/* ── Outer wrapper and nav ─────────────────────────────────── */}
      <div class="sticky top-0 z-50 px-4 sm:px-6 lg:px-10 pt-3 pb-1">
        <nav
          class="backdrop-blur-md"
          style={{
            background: "rgba(8, 12, 20, 0.72)",
            border: "1px solid rgba(245, 197, 24, 0.22)",
            "border-radius": "14px",
            "box-shadow":
              "0 4px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(245,197,24,0.06) inset",
          }}
        >
          <div class="px-4 sm:px-6">
            <div class="flex items-center justify-between h-14">
              {/* ── Logo ───────────────────────────────────── */}
              <div class="flex-shrink-0 flex items-center gap-2">
                <a href="/">
                  <img
                    src="/logo.ico"
                    alt="Saint Framework Logo"
                    class="h-8 w-8"
                  />
                </a>
                <a href="/" class="hidden sm:block">
                  <span
                    class="font-bold text-sm tracking-widest uppercase"
                    style={{
                      color: "#f5c518",
                      "font-family": "'Goldman', sans-serif",
                    }}
                  >
                    SAINT
                  </span>
                </a>
              </div>

              {/* ── Nav links ──────────────────────────────── */}
              <ul class="flex items-center space-x-5 sm:space-x-7">
                <li>
                  <a href="/" class={`text-sm ${active("/")}`}>
                    Home
                  </a>
                </li>
                <li>
                  <a href="/about" class={`text-sm ${active("/about")}`}>
                    About
                  </a>
                </li>
                <li>
                  <a href="/play" class={`text-sm ${active("/play")}`}>
                    Play
                  </a>
                </li>
                <li>
                  <a href="/create" class={`text-sm ${active("/create")}`}>
                    Create
                  </a>
                </li>
              </ul>

              {/* ── CTA buttons — auth-aware ───────────────── */}
              <div class="flex items-center gap-2">
                <Switch>
                  {/* Loading — placeholder so layout doesn't shift */}
                  <Match when={isLoading()}>
                    <div class="hidden sm:block w-16 h-7 rounded-full bg-slate-700/40 animate-pulse" />
                    <div class="w-20 h-7 rounded-full bg-slate-700/40 animate-pulse" />
                  </Match>

                  {/* Logged out — Join + Login buttons */}
                  <Match when={!isAuthenticated()}>
                    <a
                      href="/join"
                      class="btn-ghost hidden sm:inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium"
                    >
                      Join
                    </a>
                    <button
                      onClick={() => setShowModal(true)}
                      class="btn-gold inline-flex items-center px-5 py-1.5 rounded-full text-sm font-bold"
                    >
                      Login
                    </button>
                  </Match>

                  {/* Logged in — pill linking to /player */}
                  <Match when={isAuthenticated()}>
                    <A
                      href="/player"
                      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors hover:opacity-80"
                      style={{
                        background: "rgba(245,197,24,0.08)",
                        border: "1px solid rgba(245,197,24,0.25)",
                      }}
                    >
                      {/* Avatar initial */}
                      <span
                        class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-black flex-shrink-0"
                        style={{
                          background:
                            "linear-gradient(135deg, #f5c518, #d97706)",
                        }}
                      >
                        {player()?.display_name?.[0]?.toUpperCase() ?? "?"}
                      </span>
                      <span class="hidden sm:inline text-yellow-300 max-w-[120px] truncate">
                        {player()?.display_name}
                      </span>
                    </A>
                  </Match>
                </Switch>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* ── Sign-in modal ─────────────────────────────────────────── */}
      <SignInModal isOpen={showModal()} onClose={() => setShowModal(false)} />
    </>
  );
}