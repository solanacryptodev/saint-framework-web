import { Component } from "solid-js";

const Footer: Component = () => {
  return (
    <footer
      style={{
        background: "var(--darker-bg)",
        "border-top": "1px solid var(--border-color)",
      }}
    >
      <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Section */}
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <img src="/logo.ico" alt="Saint Framework Logo" class="h-8 w-8" />
              <h3
                class="text-xl font-bold gold-gradient-text"
                style={{ "font-family": "'Goldman', sans-serif" }}
              >
                SAINT
              </h3>
            </div>
            <p class="text-sm leading-relaxed" style={{ color: "var(--text-gray)" }}>
              Revolutionizing text-based gaming with immersive storytelling and cutting-edge AI technology.
            </p>
          </div>

          {/* Games Section */}
          <div>
            <h4 class="text-white font-semibold mb-4 text-sm uppercase tracking-widest">Games</h4>
            <ul class="space-y-2">
              <li>
                <a href="#" class="text-sm transition-colors" style={{ color: "var(--text-gray)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-gray)")}
                >
                  Adventure Quest
                </a>
              </li>
              <li>
                <a href="#" class="text-sm transition-colors" style={{ color: "var(--text-gray)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-gray)")}
                >
                  Mythic Realms
                </a>
              </li>
              <li>
                <a href="#" class="text-sm transition-colors" style={{ color: "var(--text-gray)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-gray)")}
                >
                  Space Odyssey
                </a>
              </li>
            </ul>
          </div>

          {/* Community Section */}
          <div>
            <h4 class="text-white font-semibold mb-4 text-sm uppercase tracking-widest">Community</h4>
            <ul class="space-y-2">
              <li>
                <a href="#" class="text-sm transition-colors" style={{ color: "var(--text-gray)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-gray)")}
                >
                  Discord
                </a>
              </li>
              <li>
                <a href="#" class="text-sm transition-colors" style={{ color: "var(--text-gray)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-gray)")}
                >
                  Forums
                </a>
              </li>
              <li>
                <a href="#" class="text-sm transition-colors" style={{ color: "var(--text-gray)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-gray)")}
                >
                  Reddit
                </a>
              </li>
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h4 class="text-white font-semibold mb-4 text-sm uppercase tracking-widest">Support</h4>
            <ul class="space-y-2">
              <li>
                <a href="#" class="text-sm transition-colors" style={{ color: "var(--text-gray)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-gray)")}
                >
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" class="text-sm transition-colors" style={{ color: "var(--text-gray)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-gray)")}
                >
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" class="text-sm transition-colors" style={{ color: "var(--text-gray)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f5c518")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-gray)")}
                >
                  Bug Reports
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div
          class="mt-12 pt-8 text-center"
          style={{ "border-top": "1px solid var(--border-color)" }}
        >
          <p class="text-sm" style={{ color: "var(--text-muted)" }}>
            © 2025 Saint Framework. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
