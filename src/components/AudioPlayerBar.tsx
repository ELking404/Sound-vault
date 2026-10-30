import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  X,
  Disc3,
  Loader2
} from 'lucide-react';
import { TrackMetadata } from '../types';

interface AudioPlayerBarProps {
  track: TrackMetadata | null;
  audioBlob?: Blob;
  audioUrl?: string;
  onClose: () => void;
  onViewCover: (url: string, title: string, artist: string) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  track,
  audioBlob,
  audioUrl,
  onClose,
  onViewCover,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackAttemptedRef = useRef<boolean>(false);
  const activeBlobUrlRef = useRef<string | null>(null);
  const currentTrackKeyRef = useRef<string | null>(null);
  const isSeekingRef = useRef<boolean>(false);

  // Manage Audio element src from Blob or URL with bulletproof fallback
  useEffect(() => {
    if (!track) {
      setIsPlaying(false);
      setIsLoading(false);
      currentTrackKeyRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
      return;
    }

    const trackKey = `${track.id}_${track.sourceUrl || ''}_${track.audioPreviewUrl || ''}_${audioBlob ? 'blob' : ''}`;
    // If the active track hasn't changed, prevent reloading or resetting currentTime
    if (trackKey === currentTrackKeyRef.current && audioRef.current && audioRef.current.src) {
      return;
    }
    currentTrackKeyRef.current = trackKey;

    fallbackAttemptedRef.current = false;
    let isCancelled = false;

    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }

    const initAudio = async () => {
      setIsLoading(true);
      let targetSrc: string | null = null;

      // 1. Direct blob provided
      if (audioBlob) {
        const blobUrl = URL.createObjectURL(audioBlob);
        activeBlobUrlRef.current = blobUrl;
        targetSrc = blobUrl;
      }

      // 2. Direct audio URL or track fullAudioUrl or audioPreviewUrl (prioritizes full song from 0:00)
      if (!targetSrc && (audioUrl || track.fullAudioUrl || track.audioPreviewUrl)) {
        targetSrc = audioUrl || track.fullAudioUrl || track.audioPreviewUrl || null;
      }

      // 3. If missing, enrich from backend server
      if (!targetSrc && (track.title || track.artist)) {
        try {
          const params = new URLSearchParams();
          if (track.artist) params.set('artist', track.artist);
          if (track.title) params.set('title', track.title);
          params.set('q', `${track.artist} ${track.title}`.trim());
          const enrichRes = await fetch(`/api/enrich?${params.toString()}`);
          if (enrichRes.ok) {
            const enrichData = await enrichRes.json();
            if (enrichData.fullAudioUrl || enrichData.audioPreviewUrl) {
              targetSrc = enrichData.fullAudioUrl || enrichData.audioPreviewUrl;
            }
          }
        } catch {
          // ignore
        }
      }

      if (isCancelled) return;
      setIsLoading(false);

      if (targetSrc && audioRef.current) {
        if (audioRef.current.src !== targetSrc && !audioRef.current.src.endsWith(targetSrc)) {
          audioRef.current.src = targetSrc;
          audioRef.current.currentTime = 0;
          audioRef.current
            .play()
            .then(() => {
              if (!isCancelled) setIsPlaying(true);
            })
            .catch(() => {
              if (!isCancelled) setIsPlaying(false);
            });
        }
      } else if (!targetSrc) {
        setIsPlaying(false);
      }
    };

    initAudio();

    return () => {
      isCancelled = true;
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, [track?.id, track?.sourceUrl, track?.fullAudioUrl, track?.audioPreviewUrl, audioBlob, audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current || !audioRef.current.src) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragTime, setDragTime] = useState<number>(0);
  const trackBarRef = useRef<HTMLDivElement | null>(null);

  const handleTimeUpdate = () => {
    if (audioRef.current && !isDragging && !isSeekingRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  // Direct calculation from mouse/touch clientX position on the track bar
  const calculateTimeFromClientX = (clientX: number): number => {
    if (!trackBarRef.current) return 0;
    const rect = trackBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const effectiveDur = duration > 0 ? duration : (audioRef.current?.duration || track?.duration || 30);
    return Math.max(0, Math.min(effectiveDur, ratio * effectiveDur));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const newTime = calculateTimeFromClientX(e.clientX);
    setIsDragging(true);
    setDragTime(newTime);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      const newTime = calculateTimeFromClientX(e.clientX);
      setDragTime(newTime);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      const finalTime = calculateTimeFromClientX(e.clientX);
      setIsDragging(false);
      setCurrentTime(finalTime);
      isSeekingRef.current = true;
      if (audioRef.current && isFinite(finalTime)) {
        const effectiveDur = duration > 0 ? duration : (audioRef.current.duration || 30);
        const clamped = Math.max(0, Math.min(finalTime, effectiveDur));
        audioRef.current.currentTime = clamped;
        if (isPlaying && audioRef.current.paused) {
          audioRef.current.play().catch(() => {});
        }
      }
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
  };

  const handleNativeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isFinite(val)) return;
    setDragTime(val);
    setCurrentTime(val);
    isSeekingRef.current = true;
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleLoop = () => {
    setIsLooping(!isLooping);
    if (audioRef.current) {
      audioRef.current.loop = !isLooping;
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!track) return null;

  const maxDuration = (duration > 0 && isFinite(duration)) ? duration : (track.duration || 30);
  const isPreview = maxDuration <= 35 && (track.duration || 0) > 45;
  const currentPos = isDragging ? dragTime : currentTime;
  const progressPercent = maxDuration > 0 ? Math.min(100, Math.max(0, (currentPos / maxDuration) * 100)) : 0;

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-900/98 backdrop-blur-lg px-3 sm:px-4 py-2 sm:py-2.5 shadow-2xl pb-safe">
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onSeeked={() => {
          isSeekingRef.current = false;
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onError={(e) => {
          e.preventDefault();
          setIsPlaying(false);
          setIsLoading(false);
        }}
        onEnded={() => {
          if (!isLooping) setIsPlaying(false);
        }}
        loop={isLooping}
      />

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-6">
        
        {/* Track Info */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 max-w-[150px] sm:max-w-[320px]">
          <div 
            onClick={() => onViewCover(track.highResCoverUrl || track.coverUrl, track.title, track.artist)}
            className="group relative h-10 w-10 sm:h-12 sm:w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-slate-800"
            title="Click to view artwork"
          >
            <img
              src={track.coverUrl}
              alt={track.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Disc3 className="h-4 w-4 text-white" />
            </div>
          </div>

          <div className="min-w-0">
            <h4 className="truncate text-xs sm:text-sm font-semibold text-white leading-tight">{track.title}</h4>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400 mt-0.5">
              <span className="truncate">{track.artist}</span>
              {isPreview && (
                <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Preview (30s)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Central Controls & Interactive Scrubber */}
        <div className="flex flex-1 flex-col items-center max-w-xl px-1">
          <div className="flex items-center gap-2 sm:gap-4 mb-0.5">
            <button
              type="button"
              onClick={toggleLoop}
              className={`rounded-xl p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
                isLooping ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white'
              }`}
              title={isLooping ? 'Disable Loop' : 'Enable Loop'}
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              disabled={isLoading}
              className="flex h-10 w-10 sm:h-11 sm:w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white text-slate-950 hover:bg-slate-200 transition-transform active:scale-95 shadow-md disabled:opacity-75"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-950" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5 fill-slate-950" />
              ) : (
                <Play className="h-5 w-5 fill-slate-950 ml-0.5" />
              )}
            </button>
          </div>

          {/* Interactive Duration Scrubber with Draggable Ball */}
          <div className="flex w-full items-center gap-2 sm:gap-3">
            <span className="font-mono text-[10px] sm:text-xs tabular-nums text-slate-300 w-8 sm:w-10 text-right shrink-0">
              {formatSeconds(currentPos)}
            </span>

            {/* Scrubber Container with wide touch area */}
            <div 
              ref={trackBarRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onLostPointerCapture={handlePointerCancel}
              className="relative flex-1 py-3.5 group cursor-pointer touch-none select-none flex items-center"
              title="Drag the duration ball or tap to jump to any moment"
            >
              {/* Background Track */}
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden relative">
                {/* Played Progress Bar */}
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Glowing Draggable Duration Ball with Touch Clearance */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full pointer-events-none transition-shadow flex items-center justify-center ${
                  isDragging 
                    ? 'w-5 h-5 bg-white ring-4 ring-indigo-500 shadow-xl shadow-indigo-500/80 scale-125' 
                    : 'w-4 h-4 bg-white ring-2 ring-indigo-500 shadow-md shadow-indigo-500/50 group-hover:scale-115'
                }`}
                style={{ 
                  left: `${progressPercent}%` 
                }}
              >
                {/* Inner core */}
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />

                {/* Floating Timestamp Tooltip during Drag */}
                {isDragging && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-md bg-indigo-600 text-[11px] font-mono font-bold text-white shadow-xl pointer-events-none whitespace-nowrap border border-indigo-400/30">
                    {formatSeconds(dragTime)} {isPreview ? '(Preview)' : ''}
                  </div>
                )}
              </div>

              {/* Native Invisible Slider for Touch/Keyboard Accessibility */}
              <input
                ref={progressInputRef}
                type="range"
                min={0}
                max={maxDuration}
                step={0.1}
                value={currentPos}
                onChange={handleNativeSliderChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full pointer-events-none"
                tabIndex={-1}
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="font-mono text-[10px] sm:text-xs tabular-nums text-slate-400 w-8 sm:w-10">
                {formatSeconds(maxDuration)}
              </span>
              {isPreview && (
                <span className="text-[9px] font-mono text-amber-400 sm:hidden">
                  (prev)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Volume & Close */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="text-slate-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="h-1.5 w-18 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500 focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Close Player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
