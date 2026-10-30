import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowDownToLine, 
  Sliders, 
  HardDrive, 
  FolderOpen, 
  RefreshCw,
  Smartphone,
  Menu,
  X,
  ChevronRight,
  Activity,
  Globe,
  ShieldCheck,
  Moon
} from 'lucide-react';
import { UserSettings } from '../types';

interface HeaderProps {
  activeTab: 'single' | 'converter' | 'settings';
  setActiveTab: (tab: 'single' | 'converter' | 'settings') => void;
  settings: UserSettings;
  onOpenSettings: () => void;
  onOpenApkModal: () => void;
  onOpenTester?: () => void;
  onOpenTermsPrivacy?: (tab: 'terms' | 'privacy') => void;
  directoryName: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onOpenSettings,
  onOpenApkModal,
  onOpenTester,
  onOpenTermsPrivacy,
  directoryName,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return localStorage.getItem('soundvault_language') || 'en';
  });
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    localStorage.setItem('soundvault_language', lang);
  };

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <>
      {/* Top App Bar (Native Android App Header + Desktop Top Bar) */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          
          {/* Brand Wordmark & Icon */}
          <div 
            onClick={() => setActiveTab('single')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer select-none"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                SoundVault
              </span>
              <span className="text-[10px] font-mono text-indigo-400 hidden sm:inline">
                Android & Hi-Res Audio
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
                activeTab === 'single'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <ArrowDownToLine className="h-4 w-4" />
              <span>Downloader</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('converter')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
                activeTab === 'converter'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Converter</span>
            </button>
          </nav>

          {/* Hamburger Menu Area - Replaces cluttered header buttons */}
          <div className="relative flex items-center shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
              className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                isMenuOpen
                  ? 'border-indigo-500/60 bg-indigo-950/60 text-indigo-300 ring-2 ring-indigo-500/20'
                  : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
              title="Menu"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5 transition-transform" />
              ) : (
                <Menu className="h-5 w-5 transition-transform" />
              )}
            </button>

            {/* Hamburger Dropdown Drawer Panel */}
            {isMenuOpen && (
              <div 
                role="menu"
                aria-orientation="vertical"
                className="absolute right-0 top-12 sm:top-14 w-72 sm:w-80 rounded-2xl border border-slate-800 bg-slate-900/98 p-2.5 shadow-2xl shadow-black/90 backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Menu Header with App Info */}
                <div className="px-3 py-2 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Quick Actions & Settings
                  </span>
                  <span className="text-[10px] font-mono text-indigo-400">
                    SoundVault
                  </span>
                </div>

                <div className="space-y-1">
                  {/* 1. Storage / Folder Path Option (previously button 2) */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center justify-between rounded-xl p-2.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 shrink-0">
                        {directoryName ? (
                          <FolderOpen className="h-4 w-4" />
                        ) : (
                          <HardDrive className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-slate-200">
                          Storage Folder
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 truncate max-w-[170px]">
                          {directoryName || settings.downloadPath.replace('~/', '')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300 shrink-0 ml-1" />
                  </button>

                  {/* 2. Install / APK Guide Option (previously button 3) */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenApkModal();
                    }}
                    className="w-full flex items-center justify-between rounded-xl p-2.5 text-left text-xs font-medium text-slate-300 hover:bg-emerald-950/30 hover:text-emerald-200 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 shrink-0">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-emerald-300">
                          Install WebAPK / Android
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Export APK & Home Screen app
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-300 shrink-0 ml-1" />
                  </button>

                  {/* 3. Audio & Tag Settings Option (previously button 4) */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center justify-between rounded-xl p-2.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white shrink-0">
                        <Sliders className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-slate-200">
                          Audio & ID3 Settings
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Format, 320k Bitrate & Cover
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300 shrink-0 ml-1" />
                  </button>

                  {/* 4. Multi-Source Diagnostic Tester */}
                  {onOpenTester && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenTester();
                      }}
                      className="w-full flex items-center justify-between rounded-xl p-2.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 shrink-0">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-slate-200">
                            Source Diagnostics
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Test multi-source APIs
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300 shrink-0 ml-1" />
                    </button>
                  )}

                  {/* 5. Legal & Privacy Policies */}
                  {onOpenTermsPrivacy && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenTermsPrivacy('privacy');
                      }}
                      className="w-full flex items-center justify-between rounded-xl p-2.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 shrink-0">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-slate-200">
                            Legal & Privacy
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Terms & Disclosures
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300 shrink-0 ml-1" />
                    </button>
                  )}

                  {/* Language Selector & Dark Theme Status */}
                  <div className="border-t border-slate-800/80 mt-1.5 pt-2 px-1 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Globe className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      <select
                        value={selectedLanguage}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        aria-label="Language selector"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 font-medium focus:outline-hidden"
                      >
                        <option value="en">English (US)</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="pt">Português</option>
                        <option value="ja">日本語</option>
                        <option value="ar">العربية</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-950/80 border border-slate-800 px-2 py-1 rounded-lg">
                      <Moon className="h-3 w-3 text-indigo-400" />
                      <span>Dark</span>
                    </div>
                  </div>

                  {/* Divider for Navigation on mobile */}
                  <div className="border-t border-slate-800/80 my-1 pt-1 md:hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setActiveTab('single');
                      }}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium transition-colors ${
                        activeTab === 'single'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`}
                    >
                      <ArrowDownToLine className="h-4 w-4 text-indigo-400" />
                      <span>Music Downloader</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setActiveTab('converter');
                      }}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium transition-colors ${
                        activeTab === 'converter'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`}
                    >
                      <RefreshCw className="h-4 w-4 text-indigo-400" />
                      <span>Audio Format Converter</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Android Native Bottom Navigation Bar (Visible on mobile viewports) */}
      <nav 
        aria-label="Android Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 pb-safe backdrop-blur-xl shadow-2xl"
      >
        <div className="grid grid-cols-3 items-center h-16 px-2">
          
          {/* 1. Downloader Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex flex-col items-center justify-center h-full min-h-[48px] rounded-xl transition-all ${
              activeTab === 'single'
                ? 'text-indigo-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'single' ? 'bg-indigo-500/15' : ''}`}>
              <ArrowDownToLine className="h-5 w-5" />
            </div>
            <span className="text-[11px] tracking-tight mt-0.5">Downloader</span>
          </button>

          {/* 2. Converter Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('converter')}
            className={`flex flex-col items-center justify-center h-full min-h-[48px] rounded-xl transition-all ${
              activeTab === 'converter'
                ? 'text-indigo-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'converter' ? 'bg-indigo-500/15' : ''}`}>
              <RefreshCw className="h-5 w-5" />
            </div>
            <span className="text-[11px] tracking-tight mt-0.5">Converter</span>
          </button>

          {/* 3. Settings Tab */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex flex-col items-center justify-center h-full min-h-[48px] rounded-xl text-slate-400 hover:text-slate-200 transition-all"
          >
            <div className="p-1 rounded-lg">
              <Sliders className="h-5 w-5" />
            </div>
            <span className="text-[11px] tracking-tight mt-0.5">Settings</span>
          </button>

        </div>
      </nav>
    </>
  );
};
