import React, { useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface CoverLightboxProps {
  coverUrl: string | null;
  title: string;
  artist: string;
  onClose: () => void;
  onDownloadCover: () => void;
}

export const CoverLightbox: React.FC<CoverLightboxProps> = ({
  coverUrl,
  title,
  artist,
  onClose,
  onDownloadCover,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!coverUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative max-w-2xl w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="text-xs text-slate-400">{artist} · High-Resolution Artwork</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 relative flex items-center justify-center rounded-xl bg-slate-950 p-2 overflow-hidden aspect-square max-h-[65vh]">
          <img
            src={coverUrl}
            alt={`${title} Cover Artwork`}
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain rounded-lg shadow-lg"
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 pt-3 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>High Fidelity JPG/PNG</span>
            <span aria-hidden="true">·</span>
            <span>Uncompressed Metadata</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={coverUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Original</span>
            </a>

            <button
              type="button"
              onClick={onDownloadCover}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Cover Art</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
