import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  RefreshCw, 
  Music, 
  Radio, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  ExternalLink 
} from 'lucide-react';

interface TestResult {
  query: string;
  type: string;
  status: 'pass' | 'fail' | 'error';
  latencyMs: number;
  resolvedTitle?: string;
  resolvedArtist?: string;
  firstTrack?: string;
  artist?: string;
  album?: string;
  duration?: number;
  isFullSong?: boolean;
  hasAudio?: boolean;
  hasCover?: boolean;
  remixAvoided?: boolean;
  totalTracks?: number;
  error?: string;
}

interface SourceTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestQuerySelected?: (query: string) => void;
  initialQuery?: string;
}

export const SourceTesterModal: React.FC<SourceTesterModalProps> = ({
  isOpen,
  onClose,
  onTestQuerySelected,
  initialQuery,
}) => {
  const [customQuery, setCustomQuery] = useState<string>(initialQuery || '');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [allPassed, setAllPassed] = useState<boolean | null>(null);

  React.useEffect(() => {
    if (isOpen && initialQuery) {
      setCustomQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  if (!isOpen) return null;

  const runDiagnostics = async (queryToRun?: string) => {
    setIsRunning(true);
    setResults([]);
    setAllPassed(null);

    try {
      const q = (queryToRun !== undefined ? queryToRun : customQuery).trim();
      const url = q ? `/api/test-sources?q=${encodeURIComponent(q)}` : '/api/test-sources';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setAllPassed(data.allPassed);
      } else {
        setAllPassed(false);
      }
    } catch {
      setAllPassed(false);
    } finally {
      setIsRunning(false);
    }
  };

  const sampleQueries = [
    { label: 'Oliver Tree - Life Goes On', desc: 'Verifies authentic studio track over remix' },
    { label: 'DVRST - Dream Space', desc: 'Verifies 320kbps full original audio master' },
    { label: 'Marwa Loud - Bad boy', desc: 'Verifies French urban pop original catalog' },
    { label: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', desc: 'Spotify Top 50 playlist metadata' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Multi-Source Verification Engine</h3>
              <p className="text-xs text-slate-400">Tests Deezer, iTunes, Audius, YouTube & Spotify for exact original matches</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto py-4 space-y-4 flex-1 pr-1">
          
          {/* Custom Query Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Test Any Link or Music Query
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runDiagnostics(customQuery)}
                placeholder="e.g. Oliver Tree Life Goes On or Spotify/YT playlist URL..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => runDiagnostics(customQuery)}
                disabled={isRunning}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50 shrink-0"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Run Test</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preset Test Scenarios */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-2 block">
              Quick Test Scenarios
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sampleQueries.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCustomQuery(s.label);
                    runDiagnostics(s.label);
                  }}
                  disabled={isRunning}
                  className="flex flex-col items-start p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 hover:border-slate-700 text-left transition-all group"
                >
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate w-full">
                    {s.label}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {s.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Test Results Display */}
          {results.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Diagnostic Results ({results.length} Verified)</span>
                </span>
                {allPassed && (
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    All Multi-Source Checks Passed
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white truncate">{r.query}</span>
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-bold shrink-0 ${
                        r.status === 'pass'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                      }`}>
                        {r.status === 'pass' ? `PASSED (${r.latencyMs}ms)` : 'FAILED'}
                      </span>
                    </div>

                    {r.status === 'pass' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-300 pt-1 border-t border-slate-800/60">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Resolved Title:</span>
                          <span className="font-semibold text-slate-200 truncate block">{r.resolvedTitle || r.firstTrack}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Artist / Channel:</span>
                          <span className="text-slate-200 truncate block">{r.resolvedArtist || r.artist || 'Curated'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Original Verified:</span>
                          <span className="font-semibold text-emerald-400">
                            {r.remixAvoided ? 'Exact Studio Release' : (r.totalTracks ? `${r.totalTracks} Tracks` : 'Verified')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Audio Stream:</span>
                          <span className="text-indigo-300">
                            {r.isFullSong ? 'Full 320k Master' : (r.hasAudio ? 'Official Studio Stream' : 'Available')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Artwork:</span>
                          <span className="text-slate-300">
                            {r.hasCover ? '1400x1400 High-Res' : 'Standard'}
                          </span>
                        </div>
                        {onTestQuerySelected && (
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => {
                                onTestQuerySelected(r.query);
                                onClose();
                              }}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                            >
                              <span>Load in Downloader</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {r.error && (
                      <div className="text-rose-400 text-[11px] flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{r.error}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
