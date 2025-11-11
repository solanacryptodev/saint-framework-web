import { useLocation } from "@solidjs/router";

export default function Nav() {
  const location = useLocation();
  const active = (path: string) =>
    path == location.pathname ? "text-purple-400" : "text-white hover:text-purple-300";
  return (
    <nav class="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          {/* Logo */}
          <div class="flex-shrink-0">
            <a href="/" class="text-2xl font-bold text-purple-400">Saint</a>
          </div>
          
          {/* Navigation Links */}
          <ul class="flex items-center space-x-4 sm:space-x-8">
            <li>
              <a href="/" class={`transition-colors ${active("/")}`}>
                Home
              </a>
            </li>
            <li>
              <a href="/about" class={`transition-colors ${active("/about")}`}>
                About
              </a>
            </li>
            <li>
              <a href="/play" class={`transition-colors ${active("/play")}`}>
                Play
              </a>
            </li>
            <li>
              <a href="/create" class={`transition-colors ${active("/create")}`}>
                Create
              </a>
            </li>
            <li>
              <a href="/join" class={`transition-colors ${active("/join")}`}>
                Join
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
