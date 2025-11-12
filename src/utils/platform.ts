// src/utils/platform.ts
export function detectPlatform(): string | null {
  const ua = navigator.userAgent;
  if (/\bWin/.test(ua)) return 'windows';
  if (/\bMac/.test(ua)) return 'macos';
  if (/\bLinux/.test(ua)) return 'linux';
  return null;
}

// Map to Tauri platform keys
export function toTauriPlatform(os: string): string | null {
  if (os === 'windows') return 'windows-x86_64'; // assume x64 for now
  if (os === 'macos') {
    return navigator.userAgent.includes('ARM') || 
           navigator.userAgent.includes('AppleWebKit') && 
           /Mac OS X 1[1-9]/.test(navigator.userAgent)
      ? 'darwin-aarch64'
      : 'darwin-x86_64';
  }
  if (os === 'linux') return 'linux-x86_64';
  return null;
}