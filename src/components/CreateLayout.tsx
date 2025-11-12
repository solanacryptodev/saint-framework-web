import { createSignal } from "solid-js";
import CreationCard from "./CreationCard";
import Footer from "./Footer";
import { detectPlatform, toTauriPlatform } from "../utils/platform";

export default function CreateLayout() {
  const [isDownloading, setIsDownloading] = createSignal(false);

  const handleDownloadInstaller = async () => {
    if (isDownloading()) return;
    
    try {
      setIsDownloading(true);
      
      // Detect platform
      const os = detectPlatform();
      if (!os) {
        alert("Could not detect your operating system. Please download manually.");
        return;
      }
      
      const platform = toTauriPlatform(os);
      console.log('platform:', platform)
      if (!platform) {
        alert(`Platform ${os} is not supported yet.`);
        return;
      }
      // Fetch download URL from API
      const response = await fetch(`/api/download-url?platform=${platform}`);

      
      if (!response.ok) {
        const error = await response.json();
        console.log('error is: ', error)
        throw new Error(error.error || 'Download failed');
      }
      
      const data = await response.json();
      
      // Initiate download
      window.location.href = data.url;
      
    } catch (error) {
      console.error('Download error:', error);
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div class="bg-slate-900 min-h-screen flex flex-col">
      {/* Main Content - Top Third */}
      <div class="flex-1 flex flex-col">
        {/* Hero Section with significant top padding */}
        <div class="pt-24 sm:pt-32 pb-16 sm:pb-20">
          <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
            {/* Title Section */}
            <div class="text-center mb-16 sm:mb-20">
              <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
                Create Your{" "}
                <span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Universe
                </span>
              </h1>
              <p class="text-slate-300 text-lg sm:text-xl max-w-3xl mx-auto">
                Choose your creation path and bring your imagination to life with the Saint Framework
              </p>
            </div>

            {/* Creation Cards */}
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
                title={isDownloading() ? "Downloading..." : "Create Game"}
                description="Build immersive text-based adventures"
                isHighlighted={true}
                onClick={() => handleDownloadInstaller()}
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

            {/* Call to Action */}
            <div class="text-center mb-16 sm:mb-20">
              <p class="text-slate-300 text-lg mb-8">
                Ready to start building? Game creation is now available with our intuitive tools.
              </p>
              <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button class="bg-transparent border-2 border-purple-400 hover:bg-purple-400/10 text-purple-300 font-semibold px-8 py-3 rounded-full text-lg transition-all duration-300">
                  View Documentation
                </button>
                <button class="bg-transparent border-2 border-pink-400 hover:bg-pink-400/10 text-pink-300 font-semibold px-8 py-3 rounded-full text-lg transition-all duration-300">
                  Browse Examples
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
