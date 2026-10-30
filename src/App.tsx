import React, { useState } from 'react';
import { Header } from './components/Header';
import { SingleDownloader } from './components/SingleDownloader';
import { AudioConverter } from './components/AudioConverter';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { CoverLightbox } from './components/CoverLightbox';
import { PathSettingsModal } from './components/PathSettingsModal';
import { AndroidApkModal } from './components/AndroidApkModal';
import { SourceTesterModal } from './components/SourceTesterModal';
import { TermsPrivacyModal } from './components/TermsPrivacyModal';
import { 
  TrackMetadata, 
  UserSettings 
} from './types';
import { loadSettings } from './services/fileSystem';
import { saveFileWithTarget } from './services/fileSystem';

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'converter' | 'settings'>('single');
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [activeDirectoryName, setActiveDirectoryName] = useState<string | null>(null);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);
  const [isTesterModalOpen, setIsTesterModalOpen] = useState<boolean>(false);
  const [testerInitialQuery, setTesterInitialQuery] = useState<string>('');
  const [isTermsPrivacyOpen, setIsTermsPrivacyOpen] = useState<boolean>(false);
  const [termsPrivacyTab, setTermsPrivacyTab] = useState<'terms' | 'privacy'>('privacy');

  const handleOpenTermsPrivacy = (tab: 'terms' | 'privacy') => {
    setTermsPrivacyTab(tab);
    setIsTermsPrivacyOpen(true);
  };

  // Audio Player Bar State
  const [activePlayerTrack, setActivePlayerTrack] = useState<TrackMetadata | null>(null);
  const [activePlayerBlob, setActivePlayerBlob] = useState<Blob | undefined>(undefined);

  // Lightbox State
  const [lightboxData, setLightboxData] = useState<{
    url: string;
    title: string;
    artist: string;
  } | null>(null);

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  const handleOpenTester = (query?: string) => {
    setTesterInitialQuery(query || '');
    setIsTesterModalOpen(true);
  };

  const handlePlayPreview = (track: TrackMetadata, blob?: Blob) => {
    setActivePlayerTrack(track);
    setActivePlayerBlob(blob);
  };

  const handleViewCover = (url: string, title: string, artist: string) => {
    setLightboxData({ url, title, artist });
  };

  const handleDownloadLightboxCover = async () => {
    if (!lightboxData) return;
    try {
      const res = await fetch(lightboxData.url);
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const cleanArtist = lightboxData.artist.replace(/[\\/:*?"<>|]/g, '');
      const cleanTitle = lightboxData.title.replace(/[\\/:*?"<>|]/g, '');
      const fileName = `${cleanArtist} - ${cleanTitle} (High-Res Cover).${ext}`;
      await saveFileWithTarget(blob, fileName);
    } catch {
      const a = document.createElement('a');
      a.href = lightboxData.url;
      a.download = `${lightboxData.title}_Cover.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Header following Top Bar Contract & Android Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'settings') {
            setIsSettingsModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        settings={settings}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenApkModal={() => setIsApkModalOpen(true)}
        onOpenTester={handleOpenTester}
        onOpenTermsPrivacy={handleOpenTermsPrivacy}
        directoryName={activeDirectoryName}
      />

      {/* Main Workspace Viewport (with dynamic clearance for Android bottom nav & player bar) */}
      <main className={`mx-auto w-full max-w-7xl flex-1 px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-8 ${activePlayerTrack ? 'pb-48 md:pb-36' : 'pb-24 md:pb-16'}`}>
        
        {activeTab === 'single' && (
          <SingleDownloader
            settings={settings}
            onPlayPreview={handlePlayPreview}
            onViewCover={handleViewCover}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onOpenTester={handleOpenTester}
            onOpenTermsPrivacy={handleOpenTermsPrivacy}
          />
        )}

        {activeTab === 'converter' && (
          <AudioConverter
            settings={settings}
            onPlayPreview={handlePlayPreview}
            onViewCover={handleViewCover}
          />
        )}

      </main>

      {/* Persistent Audio Player Bar */}
      <AudioPlayerBar
        track={activePlayerTrack}
        audioBlob={activePlayerBlob}
        onClose={() => {
          setActivePlayerTrack(null);
          setActivePlayerBlob(undefined);
        }}
        onViewCover={handleViewCover}
      />

      {/* High-Resolution Artwork Lightbox */}
      <CoverLightbox
        coverUrl={lightboxData?.url || null}
        title={lightboxData?.title || ''}
        artist={lightboxData?.artist || ''}
        onClose={() => setLightboxData(null)}
        onDownloadCover={handleDownloadLightboxCover}
      />

      {/* Custom Download Path & Audio Settings Modal */}
      <PathSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        activeDirectoryName={activeDirectoryName}
        setActiveDirectoryName={setActiveDirectoryName}
      />

      {/* Android APK & Install Guide Modal */}
      <AndroidApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />

      {/* Multi-Source Diagnostics & Resolution Tester Modal */}
      <SourceTesterModal
        isOpen={isTesterModalOpen}
        initialQuery={testerInitialQuery}
        onClose={() => setIsTesterModalOpen(false)}
        onTestQuerySelected={(query) => {
          setIsTesterModalOpen(false);
          setActiveTab('single');
        }}
      />

      {/* Terms of Service & Privacy Policy Modal */}
      <TermsPrivacyModal
        isOpen={isTermsPrivacyOpen}
        onClose={() => setIsTermsPrivacyOpen(false)}
        initialTab={termsPrivacyTab}
      />

    </div>
  );
}
