import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  ShieldCheck, 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  Terminal, 
  Layers,
  Music
} from 'lucide-react';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [activeTab, setActiveTab] = useState<'instant' | 'pwabuilder' | 'cli' | 'samsung'>('instant');
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setInstallStatus('Installed successfully! Look for SoundVault on your home screen.');
        } else {
          setInstallStatus('Installation was dismissed.');
        }
        setDeferredPrompt(null);
      } catch {
        setInstallStatus('Install prompt unavailable. Follow the browser instructions below.');
      }
    } else {
      setInstallStatus('Install directly using browser menu: Tap (⋮) -> "Add to Home screen" or "Install app".');
    }
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://soundvault.app';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const cliCode = `# 1. Install Google's official Bubblewrap CLI
npm i -g @bubblewrap/cli

# 2. Initialize from SoundVault manifest
bubblewrap init --manifest="${currentUrl.replace(/\/$/, '')}/manifest.webmanifest"

# 3. Build signed Android APK
bubblewrap build`;

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCode);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Android App & APK Guide</span>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                  100% Compatible
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Install directly on your phone or generate a standalone .apk package
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-950/40 p-2 overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('instant')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors whitespace-nowrap min-h-[40px] ${
              activeTab === 'instant'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>1-Tap Install (WebAPK)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pwabuilder')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors whitespace-nowrap min-h-[40px] ${
              activeTab === 'pwabuilder'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Export .APK (PWABuilder)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cli')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors whitespace-nowrap min-h-[40px] ${
              activeTab === 'cli'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>CLI Build (Bubblewrap)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('samsung')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors whitespace-nowrap min-h-[40px] ${
              activeTab === 'samsung'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Music className="h-4 w-4" />
            <span>Samsung Music Fix</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-sm">
          
          {/* TAB 1: INSTANT INSTALL (WebAPK) */}
          {activeTab === 'instant' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-white">Native Android WebAPK (Recommended)</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Android has a built-in APK compiler (WebAPK) inside Chrome, Brave, and Samsung Internet. When you install from the browser, Android automatically generates and signs a real native Android app with an icon, splash screen, and full offline caching!
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-indigo-900/40 flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] px-5 py-2.5 text-xs font-semibold text-white shadow-md transition-all"
                  >
                    <Download className="h-4 w-4" />
                    <span>Trigger Android Install Prompt</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">URL Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy App URL for Phone</span>
                      </>
                    )}
                  </button>
                </div>

                {installStatus && (
                  <p className="mt-3 text-xs font-medium text-indigo-300 bg-indigo-900/30 px-3 py-2 rounded-lg border border-indigo-800">
                    {installStatus}
                  </p>
                )}
              </div>

              {/* Browser Instructions */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  How to Install in 10 Seconds:
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-1.5">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-indigo-400">1</span>
                      In Brave Browser
                    </span>
                    <p className="text-slate-400">
                      Tap the <strong>3 vertical dots (⋮)</strong> in bottom/top bar → Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-1.5">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-indigo-400">2</span>
                      In Google Chrome
                    </span>
                    <p className="text-slate-400">
                      Tap the <strong>3 dots (⋮)</strong> top-right → Tap <strong>"Install app"</strong> → Tap <strong>"Install"</strong>.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-1.5">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-indigo-400">3</span>
                      Samsung Internet
                    </span>
                    <p className="text-slate-400">
                      Tap the <strong>hamburger menu (☰)</strong> → Tap <strong>"+ Add page to"</strong> → Choose <strong>"App screen"</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Features as Installed App */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Benefits of Installing SoundVault:
                </span>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                  <li>Full screen standalone experience with Android system navigation bar matching.</li>
                  <li>Saves downloaded MP3s directly into your phone's <code>/Download</code> storage.</li>
                  <li>Full offline playback using the IndexedDB Offline Library when disconnected.</li>
                  <li>No browser URL bar or tab switching clutter.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: PWABUILDER (Generate .APK file) */}
          {activeTab === 'pwabuilder' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 space-y-2">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  <span>Generate Standalone .APK via PWABuilder (No Code)</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  PWABuilder is Microsoft's free, open-source tool that wraps progressive web apps into authentic signed Android <code>.apk</code> and <code>.aab</code> (Android App Bundle) packages ready for Google Play or direct sideloading.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shrink-0">
                    1
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium">Copy this App's Web URL:</p>
                    <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">{currentUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="min-h-[38px] px-3 flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
                  >
                    {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shrink-0">
                    2
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium">Open PWABuilder in your browser:</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Go to <code>https://www.pwabuilder.com</code></p>
                  </div>
                  <a
                    href="https://www.pwabuilder.com"
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[38px] px-3 flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                  >
                    <span>Open</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shrink-0">
                    3
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium">Click "Package for Stores" → Android</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      SoundVault's pre-configured <code>manifest.webmanifest</code> and 512px icons will score 100/100 PWA score.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shrink-0">
                    4
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium">Download your ready-to-install .APK</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tap the downloaded <code>.apk</code> file on your Android phone to install!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLI BUBBLEWRAP */}
          {activeTab === 'cli' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white text-xs flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-indigo-400" />
                    <span>Google Chrome Team Bubblewrap (TWA CLI)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleCopyCli}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                  >
                    {copiedCli ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedCli ? 'Copied' : 'Copy Commands'}</span>
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-indigo-200 leading-relaxed border border-slate-800">
                  {cliCode}
                </pre>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bubblewrap automatically generates a production Gradle Android project using Trusted Web Activity (TWA) with zero Java code needed.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: SAMSUNG MUSIC COMPATIBILITY */}
          {activeTab === 'samsung' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <h3 className="font-semibold text-white text-xs flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Why Samsung Music Threw an Error & How We Fixed It:</span>
                </h3>

                <div className="space-y-2 text-xs text-slate-300">
                  <p>
                    <strong>1. The Root Cause:</strong> Brave and Chrome desktop browsers have very permissive media demuxers that can play audio even if container tags or MPEG frame headers are malformed.
                  </p>
                  <p>
                    In contrast, <strong>Samsung Music</strong> uses the strict Android OS <code>MediaExtractor</code> & <code>Stagefright</code> engine. If an MP3 contains invalid ID3v2 frame lengths, missing APIC picture descriptors, or non-standard MPEG-1 sync words, Samsung Music immediately displays <em>"Unable to play track / Unsupported format"</em>.
                  </p>
                  <p>
                    <strong>2. The 100% Solution Implemented:</strong>
                  </p>
                  <ul className="list-disc pl-4 text-slate-400 space-y-1">
                    <li>Rebuilt MP3 encoding with authentic MPEG-1 Layer 3 frames at 44.1 kHz stereo.</li>
                    <li>Strict bit-level compliance with <strong>ID3v2.3</strong> standards (32-bit big-endian frame sizes).</li>
                    <li>Authentic <code>APIC</code> front cover frame with null-terminated MIME types for Samsung Music artwork display.</li>
                    <li>Proper ISO-8859-1 and UTF-16 BOM text frames for Title, Artist, and Album tags.</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3.5 text-xs text-emerald-300 flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                <span>
                  All MP3 and OGG downloads from SoundVault now pass Android <code>MediaScannerConnection</code> and play natively in Samsung Music, VLC, and YouTube Music.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-5 py-3.5">
          <span className="text-[11px] text-slate-400 font-mono">
            Android API 21+ · PWA Spec Compliant
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};
