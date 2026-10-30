import React, { useState } from 'react';
import { X, ShieldCheck, FileText, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

interface TermsPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'privacy';
}

export const TermsPrivacyModal: React.FC<TermsPrivacyModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-privacy-title"
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900/98 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="terms-privacy-title" className="text-base font-bold text-white">
                Legal & Privacy Information
              </h2>
              <p className="text-xs text-slate-400">
                Transparent policies & local processing disclosure
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'privacy'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Privacy Policy</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'terms'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Terms of Service</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs leading-relaxed text-slate-300">
          {activeTab === 'privacy' ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-indigo-950/30 border border-indigo-800/40 p-3.5">
                <p className="text-indigo-200 font-semibold mb-1">Privacy Guarantee:</p>
                <p className="text-slate-300 text-[11px]">
                  SoundVault operates with zero tracking cookies, zero analytics beacons, and zero third-party advertising popups.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1.5">1. Local In-Browser Processing</h3>
                <p>
                  When you import, trim, re-encode, or convert audio files you own, all conversion operations run locally inside your browser’s Web Audio API and WebAssembly workers whenever technically supported. Your local files are never uploaded to any remote surveillance server.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1.5">2. Network Proxy Transparency</h3>
                <p>
                  To eliminate Cross-Origin Resource Sharing (CORS) blocks on album art and public metadata from music storefronts, lightweight caching proxies fetch public cover images and track duration. These proxies do not record user identity, IP logs, or search history.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1.5">3. Local Device Storage</h3>
                <p>
                  Your preferences (such as default format, bitrate, theme, and language) are stored exclusively in your browser’s local storage (`localStorage`). No user accounts or credentials are required.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-950/30 border border-emerald-800/40 p-3.5">
                <p className="text-emerald-200 font-semibold mb-1">Permitted & Authorized Use:</p>
                <p className="text-slate-300 text-[11px]">
                  SoundVault is designed as a high-fidelity utility for authorized media owners, musicians, and creators managing their own recordings and publicly licensed content.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1.5">1. Copyright Respect & Access Controls</h3>
                <p>
                  Users must have proper authorization or rights to process any imported files. SoundVault does not circumvent Digital Rights Management (DRM) or access-restricted content. When a source is protected or unavailable, conversion of that stream is disallowed.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1.5">2. Codec & Format Limitations</h3>
                <p>
                  Audio encoding between MP3, WAV, FLAC, and OGG formats adheres strictly to open standards. Lossless formats (such as 16-bit PCM WAV) require corresponding high-bitrate source material. Samsung Music, Android Stagefright, and iOS compatibility are prioritized using baseline ID3v2.3 tags.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1.5">3. Disclaimer of Liability</h3>
                <p>
                  The utility is provided on an &quot;as-is&quot; basis without warranties of any kind. Users are solely responsible for ensuring their usage complies with their jurisdiction&apos;s copyright regulations and fair-use provisions.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/80">
          <span className="text-[11px] text-slate-500 font-mono">
            SoundVault v2.4 · Standards Compliant
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
