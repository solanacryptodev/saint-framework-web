import { useLocation } from "@solidjs/router";

export default function Nav() {
  const location = useLocation();
  const active = (path: string) =>
    path == location.pathname
      ? "gold-gradient-text font-semibold"
      : "text-slate-300 hover:text-yellow-300 transition-colors";

  return (
    /* Outer wrapper: provides top + side padding so the bar floats */
    <div class="sticky top-0 z-50 px-4 sm:px-6 lg:px-10 pt-3 pb-1">
      <nav
        class="backdrop-blur-md"
        style={{
          background: "rgba(8, 12, 20, 0.72)",
          border: "1px solid rgba(245, 197, 24, 0.22)",
          "border-radius": "14px",
          "box-shadow": "0 4px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(245,197,24,0.06) inset",
        }}
      >
        <div class="px-4 sm:px-6">
          <div class="flex items-center justify-between h-14">
            {/* Logo */}
            <div class="flex-shrink-0 flex items-center gap-2">
              <a href="/">
                <img src="/logo.ico" alt="Saint Framework Logo" class="h-8 w-8" />
              </a>
              <a href="/" class="hidden sm:block">
                <span
                  class="font-bold text-sm tracking-widest uppercase"
                  style={{ color: "#f5c518", "font-family": "'Goldman', sans-serif" }}
                >
                  SAINT
                </span>
              </a>
            </div>

            {/* Navigation Links */}
            <ul class="flex items-center space-x-5 sm:space-x-7">
              <li>
                <a href="/" class={`text-sm ${active("/")}`}>Home</a>
              </li>
              <li>
                <a href="/about" class={`text-sm ${active("/about")}`}>About</a>
              </li>
              <li>
                <a href="/play" class={`text-sm ${active("/play")}`}>Play</a>
              </li>
              <li>
                <a href="/create" class={`text-sm ${active("/create")}`}>Create</a>
              </li>
            </ul>

            {/* CTA Buttons */}
            <div class="flex items-center gap-2">
              <a
                href="/join"
                class="btn-ghost hidden sm:inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium"
              >
                Join
              </a>
              <a
                href="/player"
                class="btn-gold inline-flex items-center px-5 py-1.5 rounded-full text-sm font-bold"
              >
                Login
              </a>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
