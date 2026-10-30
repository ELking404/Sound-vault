import React, { useState, useRef } from 'react';
import { 
  Upload, 
  ArrowRight, 
  ArrowDownToLine, 
  FileArchive, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Sliders, 
  Music, 
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { 
  AudioFormat, 
  AudioQuality, 
  CompressionLevel, 
  ConvertTask, 
  TrackMetadata, 
  UserSettings 
} from '../types';
import { convertAudioFile } from '../services/converter';
import { saveFileWithTarget } from '../services/fileSystem';
import { createBatchZip } from '../services/audioEncoder';

interface AudioConverterProps {
  settings: UserSettings;
  onPlayPreview: (track: TrackMetadata, blob?: Blob) => void;
  onViewCover: (url: string, title: string, artist: string) => void;
}

export const AudioConverter: React.FC<AudioConverterProps> = ({
  settings,
  onPlayPreview,
}) => {
  const [tasks, setTasks] = useState<ConvertTask[]>([]);
  const [isConvertingAll, setIsConvertingAll] = useState<boolean>(false);
  const [isPackagingZip, setIsPackagingZip] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  // Global defaults for new tasks
  const [globalTargetFormat, setGlobalTargetFormat] = useState<AudioFormat>('ogg');
  const [globalCompress, setGlobalCompress] = useState<boolean>(false);
  const [globalCompressionLevel, setGlobalCompressionLevel] = useState<CompressionLevel>('standard');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newTasks: ConvertTask[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';

      // Smart default target: if uploaded mp3 -> target ogg; if uploaded ogg -> target mp3!
      let target: AudioFormat = globalTargetFormat;
      if (ext === 'mp3') {
        target = 'ogg';
      } else if (ext === 'ogg') {
        target = 'mp3';
      }

      newTasks.push({
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        file,
        originalName: file.name,
        originalFormat: ext,
        originalSize: file.size,
        originalDuration: 0,
        targetFormat: target,
        compress: globalCompress,
        compressionLevel: globalCompressionLevel,
        targetBitrate: '256k',
        status: 'idle',
        progress: 0,
      });
    }

    setTasks((prev) => [...prev, ...newTasks]);
  };

  const updateTask = (id: string, updates: Partial<ConvertTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
  };

  const clearAll = () => {
    setTasks([]);
  };

  const convertSingleTask = async (task: ConvertTask) => {
    updateTask(task.id, { status: 'converting', progress: 10 });
    try {
      const result = await convertAudioFile(task, (progress) => {
        updateTask(task.id, { progress });
      });

      updateTask(task.id, {
        status: 'completed',
        progress: 100,
        convertedBlob: result.convertedBlob,
        convertedSize: result.convertedSize,
        convertedFileName: result.outputFileName,
      });
    } catch (err) {
      updateTask(task.id, {
        status: 'error',
        errorMessage: (err as Error).message,
      });
    }
  };

  const convertAllTasks = async () => {
    setIsConvertingAll(true);
    const pendingTasks = tasks.filter((t) => t.status !== 'completed');

    for (const t of pendingTasks) {
      await convertSingleTask(t);
    }
    setIsConvertingAll(false);
  };

  const downloadTaskResult = async (task: ConvertTask) => {
    if (!task.convertedBlob || !task.convertedFileName) return;
    await saveFileWithTarget(task.convertedBlob, task.convertedFileName);
  };

  const downloadAllConvertedAsZip = async () => {
    const completedTasks = tasks.filter((t) => t.status === 'completed' && t.convertedBlob);
    if (completedTasks.length === 0) return;

    setIsPackagingZip(true);
    try {
      const zipItems = completedTasks.map((t) => ({
        fileName: t.convertedFileName || `${t.originalName}.${t.targetFormat}`,
        blob: t.convertedBlob!,
      }));

      const zipBlob = await createBatchZip(zipItems);
      const zipName = `SoundVault_Converted_${new Date().toISOString().slice(0, 10)}.zip`;
      await saveFileWithTarget(zipBlob, zipName);
    } catch (err) {
      console.error('Failed to create conversion zip:', err);
    } finally {
      setIsPackagingZip(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Quick preset actions
  const setAllTargets = (target: AudioFormat) => {
    setTasks((prev) => prev.map((t) => ({ ...t, targetFormat: target })));
  };

  return (
    <div className="space-y-6">
      
      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-950/80 border border-emerald-800 px-4 py-3 text-sm text-emerald-300 font-medium shadow-lg animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Drop Zone */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Universal Audio Converter</span>
              <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                MP3 ⇄ OGG ⇄ FLAC ⇄ WAV ⇄ MP4
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Convert audio formats locally in your browser with optional dynamic range and file compression
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Select Audio Files</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.ogg,.wav,.flac,.m4a,.aac,.webm"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {/* Drag & Drop Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFilesSelected(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragOver
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950'
          }`}
        >
          <Music className="mx-auto h-8 w-8 text-slate-500 mb-2" />
          <p className="text-sm font-semibold text-slate-200">
            Drag and drop MP3, OGG, WAV, FLAC, or M4A files here
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Or click to browse from your device · Works 100% offline with zero server uploads
          </p>
        </div>
      </div>

      {/* Global Conversion & Compression Controls */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          
          {/* Quick Target Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Quick Batch Target:</span>
            
            <button
              type="button"
              onClick={() => setAllTargets('ogg')}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200 hover:border-indigo-500 hover:text-white transition-colors"
            >
              Convert All to OGG
            </button>

            <button
              type="button"
              onClick={() => setAllTargets('mp3')}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200 hover:border-indigo-500 hover:text-white transition-colors"
            >
              Convert All to MP3
            </button>

            <button
              type="button"
              onClick={() => setAllTargets('flac')}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200 hover:border-indigo-500 hover:text-white transition-colors"
            >
              Convert All to FLAC
            </button>

            <button
              type="button"
              onClick={() => setAllTargets('wav')}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200 hover:border-indigo-500 hover:text-white transition-colors"
            >
              Convert All to WAV
            </button>
          </div>

          {/* Clear Controls */}
          {tasks.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearCompleted}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Clear Completed
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                Clear All
              </button>
            </div>
          )}

        </div>

        {/* Compression Configuration Box ("compress or not option") */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          
          {/* Compression Toggle */}
          <div className="md:col-span-5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
            <div>
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-indigo-400" />
                <span>Audio Compression</span>
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                {globalCompress ? 'Active: Dynamics leveling + size optimization' : 'Disabled: Original dynamic range & fidelity'}
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={globalCompress}
                onChange={(e) => {
                  setGlobalCompress(e.target.checked);
                  // Apply to all current tasks
                  setTasks((prev) => prev.map((t) => ({ ...t, compress: e.target.checked })));
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Compression Level Selector */}
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Compression Level
            </label>
            <select
              value={globalCompressionLevel}
              disabled={!globalCompress}
              onChange={(e) => {
                const lvl = e.target.value as CompressionLevel;
                setGlobalCompressionLevel(lvl);
                setTasks((prev) => prev.map((t) => ({ ...t, compressionLevel: lvl })));
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-hidden disabled:opacity-40"
            >
              <option value="light">Light Mastering (-14dB threshold, gentle 4:1)</option>
              <option value="standard">Standard Leveling (-24dB threshold, balanced 8:1)</option>
              <option value="aggressive">Aggressive Limiting (-32dB threshold, tight 16:1 punch)</option>
            </select>
          </div>

          {/* Batch Actions Button */}
          <div className="md:col-span-3 flex items-center justify-end gap-2 pt-2 md:pt-4">
            {tasks.some((t) => t.status === 'completed') && (
              <button
                type="button"
                onClick={downloadAllConvertedAsZip}
                disabled={isPackagingZip}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                title="Download all converted files as ZIP"
              >
                <FileArchive className="h-4 w-4 text-amber-400" />
                <span>{isPackagingZip ? 'Zipping...' : 'ZIP All'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={convertAllTasks}
              disabled={isConvertingAll || tasks.length === 0}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isConvertingAll ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Converting...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Convert All ({tasks.length})</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>

      {/* Task Queue List */}
      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <RefreshCw className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">No audio files in converter queue</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Drop an MP3 or OGG file above, click &quot;Select Audio Files&quot;, or import from your Offline Library to convert.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
          <div className="divide-y divide-slate-800">
            {tasks.map((task, idx) => (
              <div 
                key={task.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors"
              >
                {/* File Info & Target Selector */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <span className="font-mono text-xs tabular-nums text-slate-500 w-5 shrink-0">
                    {idx + 1}
                  </span>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 border border-slate-800 text-indigo-400">
                    <Music className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-semibold text-white">
                      {task.originalName}
                    </h4>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-mono uppercase text-slate-300">{task.originalFormat}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(task.originalSize)}</span>
                      {task.status === 'completed' && task.convertedSize && (
                        <>
                          <span aria-hidden="true">→</span>
                          <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                            {formatBytes(task.convertedSize)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Converter Options: Source Format -> Target Format + Compress Toggle */}
                <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-start">
                  
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="bg-slate-950 border border-slate-800 px-2 py-1 rounded text-slate-300 uppercase">
                      {task.originalFormat}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
                    <select
                      value={task.targetFormat}
                      disabled={task.status === 'converting' || task.status === 'completed'}
                      onChange={(e) => updateTask(task.id, { targetFormat: e.target.value as AudioFormat })}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="ogg">OGG (.ogg)</option>
                      <option value="mp3">MP3 (.mp3)</option>
                      <option value="flac">FLAC (.flac)</option>
                      <option value="wav">WAV (.wav)</option>
                      <option value="mp4">MP4 (.mp4)</option>
                    </select>
                  </div>

                  {/* Compress badge toggle */}
                  <button
                    type="button"
                    disabled={task.status === 'converting' || task.status === 'completed'}
                    onClick={() => updateTask(task.id, { compress: !task.compress })}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                      task.compress
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {task.compress ? `Compress (${task.compressionLevel})` : 'No Compression'}
                  </button>

                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  
                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 text-xs">
                    {task.status === 'completed' && (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Ready</span>
                      </span>
                    )}

                    {task.status === 'converting' && (
                      <div className="flex items-center gap-2">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                        <span className="font-mono text-indigo-400 tabular-nums">{task.progress}%</span>
                      </div>
                    )}

                    {task.status === 'error' && (
                      <span className="flex items-center gap-1 text-rose-400" title={task.errorMessage}>
                        <AlertCircle className="h-4 w-4" />
                        <span>Failed</span>
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    {task.status === 'completed' && task.convertedBlob ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const mockMeta: TrackMetadata = {
                              id: task.id,
                              title: task.convertedFileName || task.originalName,
                              artist: 'Converted Audio',
                              album: 'SoundVault',
                              year: '2025',
                              genre: 'Audio',
                              duration: task.originalDuration || 180,
                              coverUrl: '',
                              source: 'manual',
                              sourceUrl: '',
                            };
                            onPlayPreview(mockMeta, task.convertedBlob);
                          }}
                          className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                          title="Play Converted Audio"
                        >
                          <Play className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadTaskResult(task)}
                          className="rounded-lg p-1.5 text-indigo-400 hover:bg-slate-800 hover:text-indigo-300 transition-colors"
                          title="Download Converted File"
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => convertSingleTask(task)}
                        disabled={task.status === 'converting'}
                        className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                      >
                        Convert
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                </div>

              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
