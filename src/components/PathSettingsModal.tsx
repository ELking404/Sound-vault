import React, { useState } from 'react';
import { 
  X, 
  Folder, 
  Check, 
  HelpCircle, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { AudioFormat, AudioQuality, CoverOption, UserSettings } from '../types';
import { 
  isFileSystemAccessSupported, 
  requestDirectoryPicker, 
  saveSettings, 
  formatFileName, 
  formatSubpath 
} from '../services/fileSystem';

interface PathSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  activeDirectoryName: string | null;
  setActiveDirectoryName: (name: string | null) => void;
}

export const PathSettingsModal: React.FC<PathSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  activeDirectoryName,
  setActiveDirectoryName,
}) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [pickingFolder, setPickingFolder] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handlePickFolder = async () => {
    setPickingFolder(true);
    const result = await requestDirectoryPicker();
    setPickingFolder(false);
    if (result) {
      setActiveDirectoryName(result.name);
    }
  };

  const handleAddTokenToPath = (token: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      downloadPath: prev.downloadPath + (prev.downloadPath.endsWith('/') ? '' : '/') + token,
    }));
  };

  const handleAddTokenToFileName = (token: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      namingTemplate: prev.namingTemplate + ' ' + token,
    }));
  };

  const handleSave = () => {
    saveSettings(localSettings);
    onUpdateSettings(localSettings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  // Sample track for preview
  const sampleMeta = {
    id: 'sample',
    title: 'Neon Pulse',
    artist: 'Astra Nova',
    album: 'Overdrive',
    year: '2025',
    genre: 'Synthwave',
    duration: 218,
    coverUrl: '',
    source: 'spotify' as const,
    sourceUrl: 'https://open.spotify.com',
  };

  const previewSubpath = formatSubpath(localSettings.downloadPath, sampleMeta);
  const previewFileName = formatFileName(
    localSettings.namingTemplate,
    sampleMeta,
    localSettings.defaultFormat,
    localSettings.defaultQuality
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative max-w-2xl w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">Download Path & Audio Settings</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure output directory, naming schema, format preferences, and system storage
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6">

          {/* 1. Download Path Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span>Output Download Path</span>
              </label>

              {isFileSystemAccessSupported() && (
                <button
                  type="button"
                  onClick={handlePickFolder}
                  disabled={pickingFolder}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <Folder className="h-3.5 w-3.5" />
                  <span>{activeDirectoryName ? `Folder: ${activeDirectoryName}` : 'Select Folder on Disk...'}</span>
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={localSettings.downloadPath}
                onChange={(e) => setLocalSettings({ ...localSettings, downloadPath: e.target.value })}
                placeholder="~/Music/SoundVault/{artist}/{album}"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* Path Tokens */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Insert Path Token:</span>
              {['{artist}', '{album}', '{year}', '{source}'].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => handleAddTokenToPath(token)}
                  className="rounded-md border border-slate-800 bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-slate-300 hover:border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  +{token}
                </button>
              ))}
            </div>

            {activeDirectoryName && (
              <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400 font-mono">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Direct File System Access granted to &quot;{activeDirectoryName}&quot;</span>
              </div>
            )}

            {/* Android & Samsung Music Storage Guidance */}
            <div className="mt-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3 text-xs text-emerald-200">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-300 mb-1">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Android & Samsung Music Compatibility</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                On Android devices (including Samsung Galaxy), files download directly into your system <strong>/Download</strong> storage. Samsung Music, Poweramp, and VLC automatically detect the valid ID3v2.3 tags and display the embedded album artwork immediately without errors.
              </p>
            </div>
          </div>

          {/* 2. File Naming Template */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              File Naming Format
            </label>
            <input
              type="text"
              value={localSettings.namingTemplate}
              onChange={(e) => setLocalSettings({ ...localSettings, namingTemplate: e.target.value })}
              placeholder="{artist} - {title} [{quality}]"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
            />

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Insert File Token:</span>
              {['{artist}', '{title}', '{album}', '{quality}', '{year}', '{source}'].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => handleAddTokenToFileName(token)}
                  className="rounded-md border border-slate-800 bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-slate-300 hover:border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  +{token}
                </button>
              ))}
            </div>

            {/* Live Path Preview */}
            <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-400" />
                <span>Generated File Path Preview</span>
              </div>
              <div className="font-mono text-xs text-indigo-300 break-all">
                {activeDirectoryName ? `${activeDirectoryName}/` : ''}
                {previewSubpath ? `${previewSubpath}/` : ''}
                {previewFileName}
              </div>
            </div>
          </div>

          {/* 3. Audio Defaults Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            
            {/* Format */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Default Format
              </label>
              <select
                value={localSettings.defaultFormat}
                onChange={(e) => setLocalSettings({ ...localSettings, defaultFormat: e.target.value as AudioFormat })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="mp3">MP3 (Universal)</option>
                <option value="ogg">OGG (Vorbis/Opus)</option>
                <option value="flac">FLAC (Lossless)</option>
                <option value="mp4">MP4 (Video/Audio)</option>
                <option value="wav">WAV (Studio PCM)</option>
              </select>
            </div>

            {/* Quality */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Default Bitrate
              </label>
              <select
                value={localSettings.defaultQuality}
                onChange={(e) => setLocalSettings({ ...localSettings, defaultQuality: e.target.value as AudioQuality })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="320k">320 kbps (High Fidelity)</option>
                <option value="256k">256 kbps (HQ Standard)</option>
                <option value="192k">192 kbps (Balanced)</option>
                <option value="128k">128 kbps (Compact)</option>
                <option value="lossless">Lossless 24-bit (FLAC)</option>
              </select>
            </div>

            {/* Cover Option */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cover Art Handling
              </label>
              <select
                value={localSettings.defaultCoverOption}
                onChange={(e) => setLocalSettings({ ...localSettings, defaultCoverOption: e.target.value as CoverOption })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="embed">Embed in Audio (ID3/FLAC)</option>
                <option value="bundle">Audio + Standalone Cover (.jpg)</option>
                <option value="no_cover">Audio Only (No Cover)</option>
                <option value="cover_only">Cover Art Only (HD Image)</option>
              </select>
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Path variables apply to both single and batch downloads</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm"
            >
              {saveSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Apply Settings</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
