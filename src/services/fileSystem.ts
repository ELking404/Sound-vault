import { TrackMetadata, UserSettings } from '../types';

let activeDirectoryHandle: FileSystemDirectoryHandle | null = null;

export const DEFAULT_SETTINGS: UserSettings = {
  defaultFormat: 'mp3',
  defaultQuality: '320k',
  defaultCoverOption: 'embed',
  downloadPath: '~/Music/SoundVault/{artist}/{album}',
  namingTemplate: '{artist} - {title} [{quality}]',
  useFileSystemAccess: true,
};

const SETTINGS_KEY = 'soundvault_user_settings_v1';

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function requestDirectoryPicker(): Promise<{ name: string; handle: FileSystemDirectoryHandle } | null> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }
  try {
    const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    activeDirectoryHandle = handle;
    return { name: handle.name, handle };
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.warn('Failed to pick directory:', err);
    }
    return null;
  }
}

export function getActiveDirectoryHandle(): FileSystemDirectoryHandle | null {
  return activeDirectoryHandle;
}

export function formatFileName(
  template: string,
  meta: TrackMetadata,
  format: string,
  quality: string
): string {
  const sanitize = (val: string) => val.replace(/[\\/:*?"<>|]/g, '').trim();

  const formatted = template
    .replace(/{artist}/gi, sanitize(meta.artist || 'Unknown Artist'))
    .replace(/{title}/gi, sanitize(meta.title || 'Untitled'))
    .replace(/{album}/gi, sanitize(meta.album || 'Single'))
    .replace(/{year}/gi, sanitize(meta.year || '2025'))
    .replace(/{genre}/gi, sanitize(meta.genre || 'Music'))
    .replace(/{quality}/gi, quality === 'lossless' ? 'FLAC' : quality)
    .replace(/{source}/gi, meta.source.toUpperCase())
    .replace(/{ext}/gi, format);

  // If user didn't include extension, append it
  if (!formatted.toLowerCase().endsWith(`.${format.toLowerCase()}`)) {
    return `${formatted}.${format}`;
  }
  return formatted;
}

/**
 * Resolves subpath from download path template, e.g. "Music/SoundVault/Daft Punk/Discovery"
 */
export function formatSubpath(
  pathTemplate: string,
  meta: TrackMetadata
): string {
  const sanitize = (val: string) => val.replace(/[:*?"<>|]/g, '').trim();

  return pathTemplate
    .replace(/^~\//, '')
    .replace(/{artist}/gi, sanitize(meta.artist || 'Unknown Artist'))
    .replace(/{title}/gi, sanitize(meta.title || 'Untitled'))
    .replace(/{album}/gi, sanitize(meta.album || 'Single'))
    .replace(/{year}/gi, sanitize(meta.year || '2025'))
    .replace(/{source}/gi, meta.source.toUpperCase());
}

/**
 * Saves a Blob either directly to the user's picked file system folder or via standard browser download
 */
export async function saveFileWithTarget(
  blob: Blob,
  fileName: string,
  subpath?: string
): Promise<{ method: 'direct_fs' | 'browser_download'; path: string }> {
  // 1. Try File System Access API if active directory handle exists
  if (activeDirectoryHandle) {
    try {
      let currentDir = activeDirectoryHandle;
      if (subpath) {
        const segments = subpath.split('/').filter(Boolean);
        for (const segment of segments) {
          const cleanSeg = segment.replace(/[:*?"<>|\\/]/g, '').trim();
          if (cleanSeg) {
            currentDir = await currentDir.getDirectoryHandle(cleanSeg, { create: true });
          }
        }
      }

      const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      return {
        method: 'direct_fs',
        path: `${activeDirectoryHandle.name}/${subpath ? subpath + '/' : ''}${fileName}`,
      };
    } catch (err) {
      console.warn('Direct file system write failed, falling back to browser download', err);
    }
  }

  // 2. Standard browser download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  return {
    method: 'browser_download',
    path: subpath ? `${subpath}/${fileName}` : fileName,
  };
}
