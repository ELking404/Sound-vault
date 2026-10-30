export type MediaSource = 'ytmusic' | 'spotify' | 'manual';

export type AudioFormat = 'mp3' | 'flac' | 'mp4' | 'wav' | 'ogg';

export type AudioQuality = '320k' | '256k' | '192k' | '128k' | 'lossless';

export type CoverOption = 'embed' | 'cover_only' | 'no_cover' | 'bundle';

export type CompressionLevel = 'none' | 'light' | 'standard' | 'aggressive';

export interface ConvertTask {
  id: string;
  file?: File;
  sourceBlob?: Blob;
  originalName: string;
  originalFormat: string;
  originalSize: number;
  originalAudioBuffer?: AudioBuffer;
  originalDuration: number;
  targetFormat: AudioFormat;
  compress: boolean;
  compressionLevel: CompressionLevel;
  targetBitrate: AudioQuality;
  status: 'idle' | 'decoding' | 'converting' | 'completed' | 'error';
  progress: number;
  convertedBlob?: Blob;
  convertedSize?: number;
  convertedFileName?: string;
  errorMessage?: string;
}

export type DownloadStatus = 
  | 'idle' 
  | 'resolving' 
  | 'ready' 
  | 'downloading' 
  | 'encoding' 
  | 'completed' 
  | 'error';

export type AudioRenderMode = 'full_synthesis' | 'custom_file' | 'preview_clip';

export interface TrackMetadata {
  id: string;
  source: MediaSource;
  sourceUrl: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  duration: number; // in seconds
  coverUrl: string;
  highResCoverUrl?: string;
  audioPreviewUrl?: string;
  fullAudioUrl?: string;
  isExplicit?: boolean;
  audioRenderMode?: AudioRenderMode;
  customAudioFile?: File;
  customAudioBlob?: Blob;
  trackNumber?: number;
  totalTracks?: number;
}

export interface AlbumOrPlaylist {
  id: string;
  type: 'album' | 'playlist';
  title: string;
  artist: string;
  source: MediaSource;
  sourceUrl: string;
  coverUrl: string;
  highResCoverUrl?: string;
  year?: string;
  genre?: string;
  totalTracks: number;
  tracks: TrackMetadata[];
}


export interface DownloadItem extends TrackMetadata {
  format: AudioFormat;
  quality: AudioQuality;
  coverOption: CoverOption;
  status: DownloadStatus;
  progress: number; // 0 - 100
  fileSize?: number; // in bytes
  errorMessage?: string;
  generatedBlob?: Blob;
  coverBlob?: Blob;
  outputFileName?: string;
  resolvedAt?: number;
}

export interface ExternalDownloaderEngine {
  name: string;
  url: string;
  description: string;
  badge: string;
  color: 'emerald' | 'indigo' | 'rose' | 'sky' | 'amber';
}

export interface UserSettings {
  defaultFormat: AudioFormat;
  defaultQuality: AudioQuality;
  defaultCoverOption: CoverOption;
  downloadPath: string;
  namingTemplate: string;
  useFileSystemAccess: boolean;
}
