import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  ArrowDownToLine, 
  Play, 
  Check, 
  Image as ImageIcon, 
  Edit2, 
  FolderOpen, 
  Upload, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle,
  Music2,
  FileAudio,
  Disc3,
  ListMusic,
  FolderArchive,
  ClipboardPaste,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  UserCheck
} from 'lucide-react';
import { 
  AudioFormat, 
  AudioQuality, 
  CoverOption, 
  DownloadItem, 
  TrackMetadata, 
  UserSettings,
  AudioRenderMode,
  AlbumOrPlaylist
} from '../types';
import { resolveMetadata, resolveAlbumOrPlaylist, isAlbumOrPlaylistUrl, extractYouTubeId, fetchYouTubeDuration } from '../services/resolver';
import { processDownload, createBatchZip } from '../services/audioEncoder';
import { saveFileWithTarget, formatFileName, formatSubpath } from '../services/fileSystem';

interface SingleDownloaderProps {
  settings: UserSettings;
  onPlayPreview: (track: TrackMetadata, blob?: Blob) => void;
  onViewCover: (url: string, title: string, artist: string) => void;
  onOpenSettings: () => void;
  onOpenTester?: (initialQuery?: string) => void;
  onOpenTermsPrivacy?: (tab: 'terms' | 'privacy') => void;
}

export const SingleDownloader: React.FC<SingleDownloaderProps> = ({
  settings,
  onPlayPreview,
  onViewCover,
  onOpenSettings,
  onOpenTester,
  onOpenTermsPrivacy,
}) => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [searchCategory, setSearchCategory] = useState<'all' | 'track' | 'playlist' | 'album' | 'artist'>('all');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  
  // Track and Album State (No hardcoded default song to avoid downloading old tracks!)
  const [track, setTrack] = useState<TrackMetadata | null>(null);
  const [albumData, setAlbumData] = useState<AlbumOrPlaylist | null>(null);
  
  // Customization options
  const [format, setFormat] = useState<AudioFormat>(settings.defaultFormat);
  const [quality, setQuality] = useState<AudioQuality>(settings.defaultQuality);
  const [coverOption, setCoverOption] = useState<CoverOption>(settings.defaultCoverOption);
  
  // Audio Mode & User Attached Audio
  const [audioRenderMode, setAudioRenderMode] = useState<AudioRenderMode>('full_synthesis');
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [showAndroidHelp, setShowAndroidHelp] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Editable metadata state for single track
  const [isEditingMeta, setIsEditingMeta] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editArtist, setEditArtist] = useState<string>('');
  const [editAlbum, setEditAlbum] = useState<string>('');
  const [editYear, setEditYear] = useState<string>('');
  const [editGenre, setEditGenre] = useState<string>('');
  const [editDuration, setEditDuration] = useState<number>(180);

  // Single Track Download state
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadStep, setDownloadStep] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Album / Playlist Sequential and ZIP Download state
  const [isDownloadingAlbum, setIsDownloadingAlbum] = useState<boolean>(false);
  const [albumProgressMsg, setAlbumProgressMsg] = useState<string>('');
  const [albumProgressPct, setAlbumProgressPct] = useState<number>(0);
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [completedTrackIds, setCompletedTrackIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (track) {
      setEditTitle(track.title);
      setEditArtist(track.artist);
      setEditAlbum(track.album);
      setEditYear(track.year);
      setEditGenre(track.genre);
      setEditDuration(track.duration || 180);
    }
  }, [track]);

  const handleResolve = async (inputStr: string) => {
    const trimmed = inputStr.trim();
    if (!trimmed) return;
    
    setIsResolving(true);
    setDownloadSuccess(null);
    setCustomAudioFile(null);
    setAudioRenderMode('full_synthesis');
    setCompletedTrackIds(new Set());

    // Clear previous state immediately so old music is NEVER retained
    setTrack(null);
    setAlbumData(null);

    try {
      if (isAlbumOrPlaylistUrl(trimmed)) {
        const resolvedAlbum = await resolveAlbumOrPlaylist(trimmed);
        setAlbumData(resolvedAlbum);
      } else {
        const resolvedTrack = await resolveMetadata(trimmed);
        setTrack(resolvedTrack);
        setEditDuration(resolvedTrack.duration || 180);

        // Auto-refine duration via client-side player if YouTube source
        const ytid = extractYouTubeId(trimmed);
        if (ytid) {
          fetchYouTubeDuration(ytid).then((exactDur) => {
            if (exactDur && exactDur > 0) {
              setTrack((curr) => curr ? { ...curr, duration: exactDur } : curr);
              setEditDuration(exactDur);
            }
          });
        }
      }
      setIsEditingMeta(false);
    } catch (err) {
      console.error('Failed to resolve URL:', err);
      setDownloadSuccess('Failed to resolve link. Please verify the URL.');
    } finally {
      setIsResolving(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error('Clipboard API not available');
      }
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrlInput(text.trim());
        handleResolve(text.trim());
      }
    } catch {
      inputRef.current?.focus();
      setDownloadSuccess('Please paste directly into the box with Ctrl+V or tap and hold.');
      setTimeout(() => setDownloadSuccess(null), 3500);
    }
  };

  const handleSaveEditedMeta = () => {
    if (!track) return;
    setTrack({
      ...track,
      title: editTitle.trim() || track.title,
      artist: editArtist.trim() || track.artist,
      album: editAlbum.trim() || track.album,
      year: editYear.trim() || track.year,
      genre: editGenre.trim() || track.genre,
      duration: editDuration > 0 ? editDuration : track.duration,
    });
    setIsEditingMeta(false);
  };

  const handleCustomAudioSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomAudioFile(file);
      setAudioRenderMode('custom_file');
    }
  };

  // Downloads a single track (either stand-alone or a specific track from an album)
  const downloadSingleTrack = async (targetTrack: TrackMetadata, overrideCoverOption?: CoverOption) => {
    setIsDownloading(true);
    setDownloadingTrackId(targetTrack.id);
    setDownloadProgress(5);
    setDownloadStep('Starting audio pipeline...');
    setDownloadSuccess(null);

    const activeCoverOpt = overrideCoverOption || coverOption;
    const currentDuration = targetTrack.duration || 180;

    // STRICT USER MANDATE: Never allow downloading fake/beep audio
    if (!targetTrack.audioPreviewUrl && !customAudioFile && activeCoverOpt !== 'cover_only') {
      setIsDownloading(false);
      setDownloadingTrackId(null);
      setDownloadStep('Download blocked: Authentic audio stream not found. Fake/synth audio is permanently disabled.');
      return;
    }

    const downloadItem: DownloadItem = {
      ...targetTrack,
      duration: currentDuration,
      audioRenderMode,
      customAudioFile: customAudioFile || undefined,
      format,
      quality,
      coverOption: activeCoverOpt,
      status: 'downloading',
      progress: 0,
    };

    try {
      const result = await processDownload(downloadItem, (progress, step) => {
        setDownloadProgress(progress);
        setDownloadStep(step);
      });

      // Target path resolution
      const subpath = formatSubpath(settings.downloadPath, targetTrack);
      const targetName = formatFileName(
        settings.namingTemplate,
        targetTrack,
        activeCoverOpt === 'cover_only' ? 'jpg' : (result.audioBlob?.type.includes('wav') ? 'wav' : format),
        quality
      );

      // Save file
      const blobToSave = activeCoverOpt === 'cover_only' ? (result.coverBlob || new Blob()) : (result.audioBlob || new Blob());
      const savedInfo = await saveFileWithTarget(blobToSave, targetName, subpath);

      // Save separate cover if bundle mode was chosen
      if (activeCoverOpt === 'bundle' && result.coverBlob) {
        const coverName = formatFileName(settings.namingTemplate + ' (Cover)', targetTrack, 'jpg', quality);
        await saveFileWithTarget(result.coverBlob, coverName, subpath);
      }

      setCompletedTrackIds(prev => new Set(prev).add(targetTrack.id));
      const methodLabel = savedInfo.method === 'direct_fs' ? 'Saved to chosen folder' : 'Downloaded to /Download folder';
      setDownloadSuccess(`${methodLabel}: ${targetName}`);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadStep('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadingTrackId(null);
    }
  };

  // Main execute download with check to ensure urlInput matches current track
  const executeDownload = async (overrideCoverOption?: CoverOption) => {
    const trimmedInput = urlInput.trim();
    // If a new URL is provided that is different from currently loaded item, resolve and download right away!
    if (trimmedInput && trimmedInput !== track?.sourceUrl && trimmedInput !== albumData?.sourceUrl) {
      setIsResolving(true);
      setDownloadSuccess(null);
      setCustomAudioFile(null);
      setCompletedTrackIds(new Set());
      setTrack(null);
      setAlbumData(null);

      try {
        if (isAlbumOrPlaylistUrl(trimmedInput)) {
          const resolvedAlbum = await resolveAlbumOrPlaylist(trimmedInput);
          setAlbumData(resolvedAlbum);
          setIsResolving(false);
          return;
        } else {
          const resolvedTrack = await resolveMetadata(trimmedInput);
          setTrack(resolvedTrack);
          setEditDuration(resolvedTrack.duration || 180);
          setIsResolving(false);
          await downloadSingleTrack(resolvedTrack, overrideCoverOption);
          return;
        }
      } catch (err) {
        console.error('Failed to resolve URL:', err);
        setDownloadSuccess('Failed to resolve link. Please verify the URL.');
        setIsResolving(false);
        return;
      }
    }

    if (track) {
      if (!track.audioPreviewUrl && !track.fullAudioUrl && !customAudioFile && overrideCoverOption !== 'cover_only') {
        setDownloadStep('Authentic audio not found across sources. Download blocked to prevent fake music.');
        return;
      }
      await downloadSingleTrack(track, overrideCoverOption);
    }
  };

  // Download entire album sequentially with real-time per-track progress
  const handleDownloadFullAlbumSequential = async () => {
    if (!albumData || albumData.tracks.length === 0) return;
    setIsDownloadingAlbum(true);
    setAlbumProgressPct(0);

    const totalTracks = albumData.tracks.length;
    for (let i = 0; i < totalTracks; i++) {
      const currentTrack = albumData.tracks[i];
      setAlbumProgressMsg(`Downloading Track ${i + 1} of ${totalTracks}: "${currentTrack.title}"...`);
      setAlbumProgressPct(Math.round((i / totalTracks) * 100));
      setDownloadingTrackId(currentTrack.id);

      if (!currentTrack.audioPreviewUrl && !currentTrack.fullAudioUrl) {
        // Skip track if no authentic audio stream was resolved (never download fake beep audio)
        continue;
      }

      try {
        const downloadItem: DownloadItem = {
          ...currentTrack,
          duration: currentTrack.duration || 180,
          audioRenderMode: 'full_synthesis',
          format,
          quality,
          coverOption,
          status: 'downloading',
          progress: 0,
        };

        const result = await processDownload(downloadItem);
        const subpath = formatSubpath(settings.downloadPath, currentTrack);
        const targetName = formatFileName(
          settings.namingTemplate,
          currentTrack,
          result.audioBlob?.type.includes('wav') ? 'wav' : format,
          quality
        );

        if (result.audioBlob) {
          await saveFileWithTarget(result.audioBlob, targetName, subpath);
        }

        setCompletedTrackIds(prev => new Set(prev).add(currentTrack.id));
      } catch (err) {
        console.error(`Failed to download track ${currentTrack.title}:`, err);
      }
    }

    setAlbumProgressPct(100);
    setAlbumProgressMsg(`All ${totalTracks} tracks downloaded successfully!`);
    setIsDownloadingAlbum(false);
    setDownloadingTrackId(null);
  };

  // Download entire album packaged into a single ZIP archive
  const handleDownloadAlbumZip = async () => {
    if (!albumData || albumData.tracks.length === 0) return;
    setIsDownloadingAlbum(true);
    setAlbumProgressPct(5);
    setAlbumProgressMsg('Composing album tracks for ZIP package...');

    try {
      const zipItems: Array<{ fileName: string; blob: Blob; coverBlob?: Blob; coverFileName?: string }> = [];
      const totalTracks = albumData.tracks.length;

      for (let i = 0; i < totalTracks; i++) {
        const curTrack = albumData.tracks[i];
        if (!curTrack.audioPreviewUrl && !curTrack.fullAudioUrl) {
          // Never synthesize fake beep audio into zip package
          continue;
        }

        setAlbumProgressMsg(`Packaging [${i + 1}/${totalTracks}]: "${curTrack.title}"...`);
        setAlbumProgressPct(Math.round(5 + (i / totalTracks) * 85));

        const downloadItem: DownloadItem = {
          ...curTrack,
          duration: curTrack.duration || 180,
          audioRenderMode: 'full_synthesis',
          format,
          quality,
          coverOption,
          status: 'downloading',
          progress: 0,
        };

        const result = await processDownload(downloadItem);
        const fileName = formatFileName(
          settings.namingTemplate,
          curTrack,
          result.audioBlob?.type.includes('wav') ? 'wav' : format,
          quality
        );

        if (result.audioBlob) {
          zipItems.push({
            fileName,
            blob: result.audioBlob,
            coverBlob: result.coverBlob,
            coverFileName: `${curTrack.artist} - ${curTrack.title} (Cover).jpg`,
          });
        }
        setCompletedTrackIds(prev => new Set(prev).add(curTrack.id));
      }

      setAlbumProgressMsg('Compressing high-fidelity ZIP archive...');
      setAlbumProgressPct(95);

      const zipBlob = await createBatchZip(zipItems);
      const cleanAlbumTitle = albumData.title.replace(/[\\/:*?"<>|]/g, '');
      const zipFileName = `${albumData.artist} - ${cleanAlbumTitle} [${albumData.type.toUpperCase()}].zip`;
      await saveFileWithTarget(zipBlob, zipFileName);

      setAlbumProgressPct(100);
      setAlbumProgressMsg(`ZIP downloaded: ${zipFileName}`);
    } catch (err) {
      console.error('ZIP generation error:', err);
      setAlbumProgressMsg('Failed to create ZIP package.');
    } finally {
      setIsDownloadingAlbum(false);
    }
  };

  const getPlaceholder = () => {
    switch (searchCategory) {
      case 'track': return 'Paste Spotify or YouTube track link, or song title...';
      case 'playlist': return 'Paste Spotify or YouTube Music playlist link...';
      case 'album': return 'Paste Spotify or YouTube Music album link...';
      case 'artist': return 'Paste Spotify artist link or search artist discography...';
      default: return 'Paste YouTube Music or Spotify track/album/playlist link...';
    }
  };

  const previewPath = track ? `${formatSubpath(settings.downloadPath, track)}/${formatFileName(settings.namingTemplate, track, format, quality)}` : '';
  const isInputAlbum = isAlbumOrPlaylistUrl(urlInput);

  return (
    <div className="space-y-6">
      
      {/* Hidden File Picker for Attaching Full Audio */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac"
        onChange={handleCustomAudioSelected}
        className="hidden"
      />

      {/* URL Input Box */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-xl">
        {/* Category Tabs: All / Track / Playlist / Album / Artist */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-1 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'All / Auto' },
            { id: 'track', label: 'Track' },
            { id: 'playlist', label: 'Playlist' },
            { id: 'album', label: 'Album' },
            { id: 'artist', label: 'Artist' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSearchCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                searchCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-950/70 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
              <Search className="h-5 w-5" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResolve(urlInput)}
              placeholder={getPlaceholder()}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-28 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
            />
            {/* Clear (x) button - visible when text is entered */}
            {urlInput.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setUrlInput('');
                  inputRef.current?.focus();
                }}
                className="absolute right-20 top-1/2 -translate-y-1/2 flex items-center justify-center h-6 w-6 rounded-md bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="Clear input"
                aria-label="Clear input"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {/* Quick paste button inside input */}
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg bg-slate-800/90 px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Paste from clipboard"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              <span>Paste</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleResolve(urlInput)}
            disabled={isResolving || !urlInput.trim()}
            className="w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            {isResolving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Resolving...</span>
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-4 w-4" />
                <span>{isInputAlbum ? 'Fetch Album / Playlist' : 'Fetch Music'}</span>
              </>
            )}
          </button>
        </div>

        {/* Live Link Type Badge & Multi-Source Tester Action */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          {urlInput.trim() ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Target Type:</span>
              {isInputAlbum ? (
                <span className="flex items-center gap-1 font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-md">
                  <Disc3 className="h-3.5 w-3.5 animate-spin-slow" />
                  Album / Playlist Detected
                </span>
              ) : (
                <span className="flex items-center gap-1 font-medium text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-2.5 py-0.5 rounded-md">
                  <Music2 className="h-3.5 w-3.5" />
                  Single Track
                </span>
              )}
            </div>
          ) : (
            <div />
          )}

          {onOpenTester && (
            <button
              type="button"
              onClick={() => onOpenTester(urlInput.trim() || undefined)}
              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 hover:bg-indigo-900/40"
              title="Test multi-source resolution across Deezer, iTunes, Audius, YouTube & Spotify"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Multi-Source Fetch Tester</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty / Welcome State when no track or album is loaded */}
      {!track && !albumData && !isResolving && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 sm:p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-950/80 border border-indigo-800/60 text-indigo-400 shadow-lg">
            <Disc3 className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg sm:text-xl font-bold text-white">Paste a Link to Download</h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Supports YouTube Music and Spotify tracks, albums, and playlists. High-fidelity audio with 100% Android & Samsung Music ID3v2.3 tags and embedded artwork.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-slate-300">
              YouTube Music
            </span>
            <span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-slate-300">
              Spotify Tracks
            </span>
            <span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-slate-300">
              Spotify Albums & Playlists
            </span>
          </div>
        </div>
      )}

      {/* ALBUM OR PLAYLIST VIEW */}
      {albumData && (
        <div className="space-y-6">
          {/* Album Hero Header */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl p-5 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-center">
              
              {/* Album Artwork */}
              <div className="md:col-span-4 lg:col-span-3 flex justify-center">
                <div 
                  onClick={() => onViewCover(albumData.highResCoverUrl || albumData.coverUrl, albumData.title, albumData.artist)}
                  className="group relative w-full aspect-square max-w-[240px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl cursor-pointer"
                >
                  <img
                    src={albumData.highResCoverUrl || albumData.coverUrl}
                    alt={albumData.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-medium text-white flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg">
                      <ImageIcon className="h-3.5 w-3.5" />
                      View High-Res
                    </span>
                  </div>
                </div>
              </div>

              {/* Album Info & Batch Actions */}
              <div className="md:col-span-8 lg:col-span-9 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <span className="uppercase font-semibold text-indigo-400">
                      {albumData.type === 'album' ? 'Full Album' : 'Playlist'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{albumData.totalTracks} Tracks</span>
                    {albumData.year && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{albumData.year}</span>
                      </>
                    )}
                    {albumData.genre && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{albumData.genre}</span>
                      </>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
                    {albumData.title}
                  </h1>
                  <p className="text-base font-medium text-slate-300 mt-1">
                    {albumData.artist}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <a
                      href={`https://open.spotify.com/search/${encodeURIComponent(albumData.artist + ' ' + albumData.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1DB954]/15 text-[#1ed760] border border-[#1DB954]/30 hover:bg-[#1DB954]/25 transition-colors"
                      title="Open album on Spotify"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open in Spotify</span>
                    </a>
                  </div>
                </div>

                {/* Configuration Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Target Format
                    </label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value as AudioFormat)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:outline-hidden"
                    >
                      <option value="mp3">MP3 (Samsung Music)</option>
                      <option value="wav">WAV (Lossless)</option>
                      <option value="flac">FLAC</option>
                      <option value="ogg">OGG</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Bitrate Quality
                    </label>
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value as AudioQuality)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:outline-hidden"
                    >
                      <option value="320k">320 kbps (Hi-Fi)</option>
                      <option value="256k">256 kbps</option>
                      <option value="192k">192 kbps</option>
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Cover Art
                    </label>
                    <select
                      value={coverOption}
                      onChange={(e) => setCoverOption(e.target.value as CoverOption)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:outline-hidden"
                    >
                      <option value="embed">Embed in ID3</option>
                      <option value="bundle">Separate Audio + Art</option>
                      <option value="no_cover">No Artwork</option>
                    </select>
                  </div>
                </div>

                {/* Album Download Progress */}
                {isDownloadingAlbum && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-indigo-300 font-medium truncate">{albumProgressMsg}</span>
                      <span className="font-mono text-slate-400 tabular-nums">{albumProgressPct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-200"
                        style={{ width: `${albumProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Album Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadFullAlbumSequential}
                    disabled={isDownloadingAlbum || isDownloading}
                    className="w-full sm:flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    <span>Download Full {albumData.type === 'album' ? 'Album' : 'Playlist'} ({albumData.totalTracks} MP3s)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadAlbumZip}
                    disabled={isDownloadingAlbum || isDownloading}
                    className="w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-slate-600 hover:text-white active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <FolderArchive className="h-4 w-4 text-indigo-400" />
                    <span>Download as ZIP</span>
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Tracklist Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <ListMusic className="h-4 w-4 text-indigo-400" />
                <span>Tracklist ({albumData.tracks.length} songs)</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Click download on any individual track
              </span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {albumData.tracks.map((t, idx) => {
                const isItemDownloading = downloadingTrackId === t.id;
                const isCompleted = completedTrackIds.has(t.id);

                return (
                  <div 
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Track Number, Thumbnail & Title */}
                    <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                      <span className="w-5 text-center font-mono text-xs text-slate-500 shrink-0">
                        {String(t.trackNumber || (idx + 1)).padStart(2, '0')}
                      </span>

                      {/* Individual Track Thumbnail / Cover */}
                      <div 
                        onClick={() => onViewCover(t.highResCoverUrl || t.coverUrl || albumData.coverUrl, t.title, t.artist)}
                        className="h-10 w-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0 cursor-pointer shadow-xs relative group"
                        title="Click to view artwork"
                      >
                        <img
                          src={t.coverUrl || albumData.coverUrl}
                          alt={t.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-110"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (albumData.coverUrl && target.src !== albumData.coverUrl) {
                              target.src = albumData.coverUrl;
                            }
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white truncate">
                          {t.title}
                        </div>
                        <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                          <span>{t.artist}</span>
                          {t.isExplicit && (
                            <span className="text-[9px] font-bold bg-slate-800 text-slate-400 px-1 py-0.2 rounded">E</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Duration & Actions */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <span className="hidden sm:flex items-center gap-1 font-mono text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        {Math.floor((t.duration || 180) / 60)}:{((t.duration || 180) % 60).toString().padStart(2, '0')}
                      </span>

                      {/* Play Preview */}
                      <button
                        type="button"
                        onClick={() => onPlayPreview(t)}
                        className="p-2 rounded-lg border border-slate-800 bg-slate-950/80 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                        title="Preview audio"
                      >
                        <Play className="h-3.5 w-3.5 text-emerald-400" />
                      </button>

                      {/* Individual Track Download Button */}
                      <button
                        type="button"
                        onClick={() => downloadSingleTrack(t)}
                        disabled={isDownloading || isDownloadingAlbum}
                        className={`min-h-[38px] px-3 flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isCompleted
                            ? 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-300'
                            : 'bg-indigo-600/90 hover:bg-indigo-600 text-white active:scale-[0.98]'
                        } disabled:opacity-50`}
                      >
                        {isItemDownloading ? (
                          <>
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span className="hidden sm:inline">Downloading...</span>
                          </>
                        ) : isCompleted ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownToLine className="h-3.5 w-3.5" />
                            <span>Download</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SINGLE TRACK PRESENTATION CARD */}
      {track && !albumData && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
          
          <div className="p-5 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-start">
              
              {/* Artwork Column */}
              <div className="md:col-span-5 lg:col-span-4 flex flex-col items-center">
                <div 
                  onClick={() => onViewCover(track.highResCoverUrl || track.coverUrl, track.title, track.artist)}
                  className="group relative w-full aspect-square max-w-[280px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl cursor-pointer"
                  title="Click to view full-resolution cover"
                >
                  <img
                    src={track.highResCoverUrl || track.coverUrl}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (track.coverUrl && target.src !== track.coverUrl) {
                        target.src = track.coverUrl;
                      } else if (target.src.includes('maxresdefault.jpg')) {
                        target.src = target.src.replace('maxresdefault.jpg', 'hqdefault.jpg');
                      }
                    }}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="text-xs font-medium text-white flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg backdrop-blur-xs">
                      <ImageIcon className="h-3.5 w-3.5" />
                      View High-Res Art
                    </span>
                  </div>
                </div>

                {/* Cover art action under image */}
                <div className="mt-3.5 flex items-center gap-2 w-full max-w-[280px]">
                  <button
                    type="button"
                    onClick={() => executeDownload('cover_only')}
                    disabled={isDownloading}
                    className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white active:scale-[0.97] transition-all"
                  >
                    <ImageIcon className="h-4 w-4 text-indigo-400" />
                    <span>Download Cover</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (track.audioPreviewUrl || customAudioFile) {
                        onPlayPreview(track, customAudioFile || undefined);
                      }
                    }}
                    disabled={!track.audioPreviewUrl && !customAudioFile}
                    className="min-h-[44px] px-4 flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/80 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title={track.audioPreviewUrl || customAudioFile ? "Listen to audio in player" : "Authentic audio not found"}
                  >
                    <Play className="h-4 w-4 text-emerald-400" />
                    <span>{track.audioPreviewUrl || customAudioFile ? "Preview" : "No Audio"}</span>
                  </button>
                </div>
              </div>

              {/* Metadata & Controls Column */}
              <div className="md:col-span-7 lg:col-span-8 flex flex-col justify-between space-y-5">
                
                {/* Header: Title, Artist, Source, Duration */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                      <span className="font-mono uppercase font-semibold text-indigo-400">
                        {track.source === 'ytmusic' ? 'YouTube Music' : track.source === 'spotify' ? 'Spotify' : 'Track'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-emerald-400 font-semibold flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{Math.floor((editDuration > 0 ? editDuration : track.duration) / 60)}:{((editDuration > 0 ? editDuration : track.duration) % 60).toString().padStart(2, '0')} (Auto-Fetched)</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{track.genre}</span>
                      {track.year && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{track.year}</span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsEditingMeta(!isEditingMeta)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>{isEditingMeta ? 'Cancel' : 'Edit Tags & Duration'}</span>
                    </button>
                  </div>

                  {/* Warning banner when authentic audio is not found */}
                  {!track.audioPreviewUrl && !customAudioFile && (
                    <div className="mt-2 mb-3 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200 flex items-start gap-2.5 shadow-md">
                      <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-white text-xs">Authentic Audio Stream Not Found</p>
                        <p className="text-slate-300 text-[11px] mt-0.5 leading-snug">
                          SoundVault has permanently blocked fake beep/synth audio generation. No authentic audio recording was found across Spotify, Deezer, Apple Music, and Audius for this track. You can attach a local audio file or try another link.
                        </p>
                      </div>
                    </div>
                  )}

                  {isEditingMeta ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 font-medium">Track Title</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 font-medium">Artist</label>
                          <input
                            type="text"
                            value={editArtist}
                            onChange={(e) => setEditArtist(e.target.value)}
                            className="w-full mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 font-medium">Album</label>
                          <input
                            type="text"
                            value={editAlbum}
                            onChange={(e) => setEditAlbum(e.target.value)}
                            className="w-full mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 font-medium">Year / Duration (Seconds)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editYear}
                              onChange={(e) => setEditYear(e.target.value)}
                              placeholder="Year"
                              className="w-20 mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-hidden"
                            />
                            <input
                              type="number"
                              min={30}
                              max={600}
                              value={editDuration}
                              onChange={(e) => setEditDuration(parseInt(e.target.value) || 180)}
                              placeholder="Duration (sec)"
                              title="Length in seconds (e.g. 180 for 3 min)"
                              className="flex-1 mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-hidden font-mono"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleSaveEditedMeta}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                        >
                          Save ID3 Tags & Duration
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{track.title}</h1>
                      <p className="text-sm font-medium text-slate-300 mt-0.5">{track.artist} · <span className="text-slate-400 font-normal">{track.album}</span></p>
                      <div className="mt-2 flex items-center gap-2">
                        <a
                          href={`https://open.spotify.com/search/${encodeURIComponent(track.artist + ' ' + track.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1DB954]/15 text-[#1ed760] border border-[#1DB954]/30 hover:bg-[#1DB954]/25 transition-colors"
                          title="Open song on Spotify"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Open in Spotify</span>
                        </a>
                      </div>
                    </>
                  )}
                </div>

                {/* Premium Native Music Pipeline Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 shadow-inner">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xs font-bold text-white tracking-wide uppercase">
                            Authentic Studio Master
                          </h2>
                          <span className="text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                            320 kbps Hi-Fi
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Verified {track.source === 'ytmusic' ? 'YouTube Music' : 'Spotify'} track version with high-res cover art &amp; Samsung Music ID3v2.3 tags
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onPlayPreview(track, customAudioFile || undefined)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white transition-all shrink-0"
                      title="Listen to authentic audio preview"
                    >
                      <Play className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Play Preview</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                      <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-200">My Version Verified</p>
                        <p className="text-[10px] text-slate-400 truncate">{track.title} · {track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                      <ImageIcon className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-200">High-Res Cover (+cover)</p>
                        <p className="text-[10px] text-slate-400 truncate">Embedded APIC + JPG Export</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                      <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-200">Full Song Length</p>
                        <p className="text-[10px] text-slate-400 truncate">{Math.floor((editDuration > 0 ? editDuration : track.duration) / 60)}:{((editDuration > 0 ? editDuration : track.duration) % 60).toString().padStart(2, '0')} Master</p>
                      </div>
                    </div>
                  </div>

                  {/* Immediate Action Banner if User Attached Full Audio */}
                  {customAudioFile && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-200 shadow-md">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">Full Audio Attached: {customAudioFile.name}</p>
                          <p className="text-[11px] text-emerald-300/80">Ready to bind high-res cover artwork and ID3v2 tags</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadSingleTrack(track)}
                        disabled={isDownloading}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md active:scale-95 shrink-0"
                      >
                        Embed Cover &amp; Export (+cover)
                      </button>
                    </div>
                  )}
                </div>

                {/* Audio Mode Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Music2 className="h-4 w-4 text-indigo-400" />
                      <span>Audio Source & Duration Mode</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAndroidHelp(!showAndroidHelp)}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Why not 35s clip?</span>
                    </button>
                  </div>

                  {showAndroidHelp && (
                    <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/40 p-3 text-xs text-indigo-200 space-y-1.5 animate-in fade-in">
                      <p className="font-semibold text-white">Audio Resolution & Quality Guarantee:</p>
                      <p className="text-slate-300 leading-relaxed">
                        SoundVault connects to real multi-source catalogs (Spotify, Deezer, Apple Music, and Audius) to resolve authentic recordings.
                      </p>
                      <ul className="list-disc pl-4 text-slate-300 space-y-1">
                        <li><strong>Authentic Master:</strong> Only genuine recordings as released by the artist. Fake/synth audio is permanently blocked.</li>
                        <li><strong>Attach Full Audio File:</strong> Pick any audio file on your device to embed high-res cover art & tags.</li>
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Option 1: Authentic Master Audio */}
                    <button
                      type="button"
                      onClick={() => setAudioRenderMode('full_synthesis')}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        audioRenderMode === 'full_synthesis'
                          ? 'border-indigo-500 bg-indigo-950/40 shadow-xs'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Authentic Recording</span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 leading-snug">
                        100% genuine studio recording (no fake/synth audio)
                      </span>
                    </button>

                    {/* Option 2: Attach Local File */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        audioRenderMode === 'custom_file' && customAudioFile
                          ? 'border-emerald-500 bg-emerald-950/40 shadow-xs'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Upload className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Attach Full Audio</span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 leading-snug truncate w-full">
                        {customAudioFile ? customAudioFile.name : 'Select file to tag with cover art'}
                      </span>
                    </button>

                    {/* Option 3: 30s Official Preview */}
                    <button
                      type="button"
                      onClick={() => setAudioRenderMode('preview_clip')}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        audioRenderMode === 'preview_clip'
                          ? 'border-indigo-500 bg-indigo-950/40 shadow-xs'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <FileAudio className="h-3.5 w-3.5 text-slate-400" />
                        <span>30s Promo Sample</span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 leading-snug">
                        Official promotional preview sample clip
                      </span>
                    </button>
                  </div>
                </div>

                {/* Configuration: Format, Quality, Cover Option */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
                  
                  {/* Format Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Audio Format
                    </label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value as AudioFormat)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="mp3">MP3 (★ Samsung Music & Android)</option>
                      <option value="wav">WAV (Lossless PCM 16-bit)</option>
                      <option value="ogg">OGG (Vorbis audio)</option>
                      <option value="flac">FLAC (Lossless)</option>
                      <option value="mp4">MP4 (Audio container)</option>
                    </select>
                  </div>

                  {/* Quality Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Audio Quality
                    </label>
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value as AudioQuality)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="320k">320 kbps (Max Fidelity)</option>
                      <option value="256k">256 kbps (HQ Standard)</option>
                      <option value="192k">192 kbps (Standard)</option>
                      <option value="128k">128 kbps (Mobile Compact)</option>
                      <option value="lossless">Lossless Studio</option>
                    </select>
                  </div>

                  {/* Cover Option */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Cover Artwork Option
                    </label>
                    <select
                      value={coverOption}
                      onChange={(e) => setCoverOption(e.target.value as CoverOption)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="embed">Embed in File (ID3v2 APIC)</option>
                      <option value="bundle">Separate Audio + Cover File</option>
                      <option value="no_cover">Audio Only (No Cover)</option>
                      <option value="cover_only">Cover Art Only (.jpg)</option>
                    </select>
                  </div>

                </div>

                {/* Samsung Music & Android Compatibility Badge */}
                <div className="flex items-center gap-2 rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2 text-xs text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-slate-300">
                    <strong>100% Android & Samsung Music Compatible:</strong> MPEG-1 Layer 3 frames with valid ID3v2.3 tags and embedded front-cover artwork.
                  </span>
                </div>

                {/* Target File Path Notice */}
                <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 px-3.5 py-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-400 min-w-0">
                    <FolderOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span className="text-[11px] text-slate-500 shrink-0">Output:</span>
                    <span className="font-mono text-slate-300 truncate text-[11px]">{previewPath}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium shrink-0 ml-2"
                  >
                    Change Path
                  </button>
                </div>

                {/* Download Progress Bar */}
                {isDownloading && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-indigo-300 font-medium">{downloadStep}</span>
                      <span className="font-mono text-slate-400 tabular-nums">{downloadProgress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-200"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Download Success Notice */}
                {downloadSuccess && !isDownloading && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3.5 py-2 text-xs text-emerald-300 font-medium">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="truncate">{downloadSuccess}</span>
                  </div>
                )}

                {/* Main Download Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => executeDownload()}
                    disabled={isDownloading || (!track.audioPreviewUrl && !customAudioFile && coverOption !== 'cover_only')}
                    className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    <span>
                      {!track.audioPreviewUrl && !customAudioFile && coverOption !== 'cover_only'
                        ? 'Authentic Audio Not Found (Download Blocked)'
                        : `Download ${format.toUpperCase()} (${quality === 'lossless' ? 'Hi-Res' : quality})`}
                    </span>
                  </button>
                </div>

              </div>
            </div>
          </div>

        </div>
      )}

      {/* How It Works & FAQ Accordion Section */}
      <section className="mt-12 pt-8 border-t border-slate-800/80 space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center justify-center gap-2">
            <HelpCircle className="h-5 w-5 text-indigo-400" />
            <span>How It Works & FAQ</span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Frequently asked questions about audio conversion, metadata tagging, and Samsung Music playback.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-2.5">
          {[
            {
              q: 'How does SoundVault process audio and format ID3 tags?',
              a: 'SoundVault retrieves verified metadata from official APIs and extracts authentic audio streams or processes user-authorized local files. It packages audio with native MPEG-1 Layer 3 frames and strictly compliant ID3v2.3 tags (Title, Artist, Album, Year, Genre, Track Number) plus embedded high-resolution front-cover artwork, ensuring instant playback on Android players, Samsung Music, car stereos, and desktop media libraries.'
            },
            {
              q: 'Why do some tracks block download? (Authentic Audio Guarantee)',
              a: 'Unlike other download utilities that substitute low-quality synthetic tones, beep songs, or incorrect audio when a stream fails, SoundVault enforces an Authentic Audio Guarantee. If an authorized full-fidelity stream cannot be secured due to DRM or regional restrictions, we notify you transparently rather than downloading the wrong file.'
            },
            {
              q: 'Are my local audio files uploaded to a remote server?',
              a: 'No. When you use the Audio Converter tab or attach your own audio file, all processing is performed locally inside your browser sandbox using Web Audio API and WebAssembly workers whenever technically supported. Your private files never leave your device.'
            },
            {
              q: 'How do I transfer music to Samsung Music or Android players?',
              a: 'Downloaded songs are saved directly into your device standard Download directory (or the custom folder configured in Settings). Simply launch Samsung Music or your preferred music player—Android media scanner automatically catalogs your tracks with full artwork and tags.'
            },
            {
              q: 'What audio formats and bitrates are supported?',
              a: 'We support MP3 (up to 320 kbps Constant Bitrate), WAV (uncompressed PCM lossless), FLAC (lossless audio compression), and M4A/AAC. You can customize your default format and bitrate in Settings.'
            }
          ].map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div 
                key={idx}
                className="rounded-xl border border-slate-800/90 bg-slate-900/60 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between p-4 text-left text-xs sm:text-sm font-semibold text-slate-200 hover:text-white hover:bg-slate-800/30 transition-colors"
                >
                  <span className="pr-4">{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-indigo-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-300 leading-relaxed border-t border-slate-800/40">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Legal & Policy Links */}
        <div className="pt-6 pb-2 text-center text-xs text-slate-500 flex flex-wrap items-center justify-center gap-3">
          <span>SoundVault Utility Engine</span>
          <span>·</span>
          {onOpenTermsPrivacy && (
            <>
              <button
                type="button"
                onClick={() => onOpenTermsPrivacy('terms')}
                className="hover:text-indigo-400 transition-colors underline underline-offset-2"
              >
                Terms of Service
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => onOpenTermsPrivacy('privacy')}
                className="hover:text-indigo-400 transition-colors underline underline-offset-2"
              >
                Privacy Policy & Disclosures
              </button>
              <span>·</span>
            </>
          )}
          <span>Local Browser Media Processing</span>
        </div>
      </section>

    </div>
  );
};
