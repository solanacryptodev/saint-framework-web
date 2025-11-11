import { Component } from "solid-js";

const Footer: Component = () => {
  return (
    <footer class="bg-slate-950 border-t border-slate-800">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Section */}
          <div class="space-y-4">
            <h3 class="text-2xl font-bold text-purple-400">Saint Framework</h3>
            <p class="text-slate-400 text-sm leading-relaxed">
              Revolutionizing text-based gaming with immersive storytelling and cutting-edge technology.
            </p>
          </div>

          {/* Games Section */}
          <div>
            <h4 class="text-white font-semibold mb-4">Games</h4>
            <ul class="space-y-2">
              <li>
                <a href="#" class="text-slate-400 hover:text-purple-400 transition-colors text-sm">
                  Adventure Quest
                </a>
              </li>
              <li>
                <a href="#" class="text-slate-400 hover:text-purple-400 transition-colors text-sm">
                  Mythic Realms
                </a>
              </li>
              <li>
                <a href="#" class="text-slate-400 hover:text-purple-400 transition-colors text-sm">
                  Space Odyssey
                </a>
              </li>
            </ul>
          </div>

          {/* Community Section */}
          <div>
            <h4 class="text-white font-semibold mb-4">Community</h4>
            <ul class="space-y-2">
              <li>
                <a href="#" class="text-slate-400 hover:text-purple-400 transition-colors text-sm">
                  Discord
                </a>
              </li>
              <li>
                <a href="#" class="text-slate-400 hover:text-purple-400 transition-colors text-sm">
                  Forums
                </a>
              </li>
              <li>
                <a href="#" class="text-slate-400 hover:text-purple-400 transition-colors text-sm">
                  Reddit
                </a>
              </li>
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h4 class="text-white font-semibold mb-4">Support</h4>
            <ul class="space-y-2">
              <li>
                <a href="#" class="text-slate-400 hover:text-purple-400 transition-colors text-sm">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" class="text-slate-400 hover:text-purple-400 transition-colors text-sm">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" class="text-slate-400 hover:text-purple-400 transition-colors text-sm">
                  Bug Reports
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div class="mt-12 pt-8 border-t border-slate-800 text-center">
          <p class="text-slate-500 text-sm">
            © 2024 Saint Framework. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
