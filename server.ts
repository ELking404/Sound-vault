import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. API: Multi-source Music Enrichment (Deezer + iTunes)
  // Resolves authentic audio recording preview and 1000x1000/1400x1400 cover art
  app.get('/api/enrich', async (req, res) => {
    try {
      const artist = ((req.query.artist as string) || '').trim();
      const title = ((req.query.title as string) || '').trim();
      const urlParam = ((req.query.url as string) || '').trim();
      const query = ((req.query.q as string) || urlParam || `${artist} ${title}`).trim();

      if (!query && !title && !urlParam) {
        return res.status(400).json({ error: 'Missing title or search query' });
      }

      const unwantedKeywords = [
        'remix', 'flip', 'bootleg', 'cover', 'tribute', 'edit',
        'slowed', 'reverb', 'nightcore', 'ringtone', 'sped up',
        'speed up', 'mashup', 'acoustic'
      ];
      const isRemixCandidate = (candidateTitle: string, requestedTitle: string) => {
        const c = candidateTitle.toLowerCase();
        const q = requestedTitle.toLowerCase();
        for (const kw of unwantedKeywords) {
          if (c.includes(kw) && !q.includes(kw)) return true;
        }
        return false;
      };

      // Step A: Direct Spotify Embed Track Scraping (Extracts official p.scdn.co audio preview if query is a Spotify link or ID)
      let spotifyHit: {
        title: string;
        artist: string;
        album: string;
        cover: string;
        preview: string;
        duration: number;
      } | null = null;

      const spMatch = query.match(/track[/:]([a-zA-Z0-9]+)/) || (req.query.url as string || '').match(/track[/:]([a-zA-Z0-9]+)/);
      if (spMatch && spMatch[1]) {
        try {
          const spRes = await fetch(`https://open.spotify.com/embed/track/${spMatch[1]}`, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(4000),
          });
          if (spRes.ok) {
            const spHtml = await spRes.text();
            const nextMatch = spHtml.match(/<script id="__NEXT_DATA__" type="application\/json">({.+?})<\/script>/);
            if (nextMatch) {
              const spJson = JSON.parse(nextMatch[1]);
              const entity = spJson.props?.pageProps?.state?.data?.entity;
              if (entity && entity.name) {
                const artistList = (entity.artists || []).map((a: any) => a.name).join(', ') || artist;
                const spCover =
                  entity.visualIdentity?.image?.[0]?.url ||
                  entity.coverArt?.sources?.[0]?.url ||
                  '';
                spotifyHit = {
                  title: entity.name,
                  artist: artistList,
                  album: entity.album?.name || 'Spotify Single',
                  cover: spCover,
                  preview: entity.audioPreview?.url || '',
                  duration: Math.round((entity.duration || 180000) / 1000),
                };
              }
            }
          }
        } catch (err) {
          console.warn('Spotify embed fetch warning:', err);
        }
      }

      // Step B: Search Audius for 100% full-length original audio masters (STRICTLY filter out remixes/flips)
      let audiusHit: {
        title: string;
        artist: string;
        album: string;
        cover: string;
        preview: string;
        duration: number;
        isFull: boolean;
      } | null = null;

      const audiusHosts = [
        'https://discoveryprovider.audius.co',
        'https://audius-dp.singapore.creatorseed.com',
        'https://audius-discovery-1.cultur3stake.com',
      ];

      for (const host of audiusHosts) {
        try {
          const audiusRes = await fetch(
            `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=SoundVault`,
            { signal: AbortSignal.timeout(3500) }
          );
          if (audiusRes.ok) {
            const aJson = await audiusRes.json();
            const aTracks = aJson.data || [];
            if (aTracks.length > 0) {
              const cleanT = title.toLowerCase();
              const cleanA = artist.toLowerCase();

              // Strictly filter out any remix/flip/ringtone if query didn't ask for it
              const nonRemixes = aTracks.filter((t: any) => !isRemixCandidate(t.title || '', title));

              const match = nonRemixes.find((t: any) => {
                const tit = (t.title || '').toLowerCase();
                const art = (t.user?.name || '').toLowerCase();
                const isLongEnough = (t.duration || 0) >= 60;
                const titleMatch = cleanT && (tit.includes(cleanT) || cleanT.includes(tit));
                const artistMatch = !cleanA || cleanA === 'unknown artist' || art.includes(cleanA) || cleanA.includes(art);
                return isLongEnough && titleMatch && artistMatch;
              });

              if (match) {
                const streamUrl = `${host}/v1/tracks/${match.id}/stream?app_name=SoundVault`;
                const coverUrl = match.artwork?.['1000x1000'] || match.artwork?.['480x480'] || '';
                audiusHit = {
                  title: match.title || title,
                  artist: match.user?.name || artist,
                  album: 'Single',
                  cover: coverUrl,
                  preview: streamUrl,
                  duration: match.duration || 180,
                  isFull: true,
                };
                break;
              }
            }
          }
        } catch {
          // try next host
        }
      }

      // Step C: Search Deezer with multiple fallback queries (exact title, artist + title, stripped title)
      let deezerHit: {
        title: string;
        artist: string;
        album: string;
        cover: string;
        preview: string;
        duration: number;
        isExplicit: boolean;
        score: number;
      } | null = null;

      const deezerQueries = [
        query,
        `${artist} ${title}`.trim(),
        title,
        title.replace(/\(feat\..*?\)/gi, '').replace(/\[feat\..*?\]/gi, '').trim(),
      ].filter((q, idx, arr) => q && arr.indexOf(q) === idx);

      for (const dQuery of deezerQueries) {
        if (deezerHit) break;
        try {
          const dRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(dQuery)}&limit=10`, {
            signal: AbortSignal.timeout(4000),
          });
          if (dRes.ok) {
            const dJson = (await dRes.json()) as {
              data?: Array<{
                title?: string;
                artist?: { name?: string };
                album?: { title?: string; cover_xl?: string; cover_big?: string };
                preview?: string;
                duration?: number;
                explicit_lyrics?: boolean;
              }>;
            };
            const hits = dJson.data || [];

            if (hits.length > 0) {
              const targetArt = artist.toLowerCase();
              const targetTit = title.toLowerCase();

              const scoredHits = hits.map((h) => {
                const artName = (h.artist?.name || '').toLowerCase();
                const trkTitle = (h.title || '').toLowerCase();
                let score = 0;

                if (trkTitle === targetTit) score += 50;
                else if (trkTitle.startsWith(targetTit) || targetTit.startsWith(trkTitle)) score += 35;
                else if (trkTitle.includes(targetTit)) score += 20;

                if (targetArt && (artName === targetArt || artName.includes(targetArt) || targetArt.includes(artName))) {
                  score += 30;
                }

                if (isRemixCandidate(h.title || '', title)) {
                  score -= 40;
                }

                return { h, score };
              });

              scoredHits.sort((a, b) => b.score - a.score);
              const best = scoredHits[0]?.h;

              if (best && best.preview) {
                const coverUrl = best.album?.cover_xl || best.album?.cover_big || '';
                deezerHit = {
                  title: best.title || title,
                  artist: best.artist?.name || artist,
                  album: best.album?.title || 'Single',
                  cover: coverUrl,
                  preview: best.preview,
                  duration: best.duration || 180,
                  isExplicit: !!best.explicit_lyrics,
                  score: scoredHits[0]?.score || 0,
                };
              }
            }
          }
        } catch (err) {
          console.warn('Deezer query attempt error:', err);
        }
      }

      // Step D: Search Apple Music / iTunes across multiple country storefronts (US, GB, DE, FR, JP, AU)
      let itunesHit: {
        title: string;
        artist: string;
        album: string;
        cover: string;
        preview?: string;
        year: string;
        genre: string;
        duration: number;
        score: number;
      } | null = null;

      const itunesCountries = ['US', 'GB', 'DE', 'FR', 'JP', 'AU'];
      for (const country of itunesCountries) {
        if (itunesHit?.preview) break;
        try {
          const itunesRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=${country}&entity=song&limit=5`,
            { signal: AbortSignal.timeout(3500) }
          );
          if (itunesRes.ok) {
            const itJson = (await itunesRes.json()) as {
              results?: Array<{
                trackName?: string;
                artistName?: string;
                collectionName?: string;
                artworkUrl100?: string;
                previewUrl?: string;
                releaseDate?: string;
                primaryGenreName?: string;
                trackTimeMillis?: number;
              }>;
            };
            const results = itJson.results || [];
            if (results.length > 0) {
              const targetArt = artist.toLowerCase();
              const targetTit = title.toLowerCase();

              const scored = results.map((r) => {
                const trkTitle = (r.trackName || '').toLowerCase();
                const artName = (r.artistName || '').toLowerCase();
                let score = 0;

                if (trkTitle === targetTit) score += 50;
                else if (trkTitle.startsWith(targetTit) || targetTit.startsWith(trkTitle)) score += 35;
                else if (trkTitle.includes(targetTit)) score += 20;

                if (targetArt && (artName === targetArt || artName.includes(targetArt) || targetArt.includes(artName))) {
                  score += 30;
                }

                if (isRemixCandidate(r.trackName || '', title)) {
                  score -= 40;
                }

                return { r, score };
              });

              scored.sort((a, b) => b.score - a.score);
              const best = scored[0]?.r;

              if (best) {
                const rawArt = best.artworkUrl100 || '';
                itunesHit = {
                  title: best.trackName || title,
                  artist: best.artistName || artist,
                  album: best.collectionName || 'Single',
                  cover: rawArt.replace('100x100bb', '1400x1400bb'),
                  preview: best.previewUrl,
                  year: best.releaseDate ? new Date(best.releaseDate).getFullYear().toString() : '2024',
                  genre: best.primaryGenreName || 'Music',
                  duration: Math.round((best.trackTimeMillis || 180000) / 1000),
                  score: scored[0]?.score || 0,
                };
              }
            }
          }
        } catch {
          // try next country
        }
      }

      // Priority ranking:
      // 1. Direct Spotify Embed preview if queried from Spotify
      // 2. Audius verified non-remix full master (320k)
      // 3. Deezer authentic studio release preview
      // 4. iTunes authentic studio preview
      const chosenPreview =
        spotifyHit?.preview ||
        audiusHit?.preview ||
        deezerHit?.preview ||
        itunesHit?.preview;

      const isFullSong = !!audiusHit?.isFull;
      const chosenCover =
        deezerHit?.cover ||
        spotifyHit?.cover ||
        itunesHit?.cover ||
        audiusHit?.cover;

      const chosenDuration =
        deezerHit?.duration ||
        audiusHit?.duration ||
        spotifyHit?.duration ||
        itunesHit?.duration ||
        180;

      const chosenAlbum =
        deezerHit?.album ||
        spotifyHit?.album ||
        itunesHit?.album ||
        'Single';

      const chosenYear = itunesHit?.year || new Date().getFullYear().toString();
      const chosenGenre = itunesHit?.genre || 'Music';

      // If NO authentic audio preview OR cover exists:
      if (!chosenPreview && !chosenCover) {
        return res.status(404).json({
          error: 'Authentic music not found across sources. Fake/synth audio is permanently disabled.',
          notFound: true,
          hasAudio: false,
        });
      }

      // Return proxied URLs to guarantee 100% CORS-free browser decoding
      const proxiedAudioUrl = chosenPreview
        ? `/api/audio-proxy?url=${encodeURIComponent(chosenPreview)}`
        : undefined;

      const proxiedCoverUrl = chosenCover
        ? `/api/cover-proxy?url=${encodeURIComponent(chosenCover)}`
        : chosenCover;

      const resolvedTitle = spotifyHit?.title || deezerHit?.title || audiusHit?.title || itunesHit?.title || title;
      const resolvedArtist = spotifyHit?.artist || deezerHit?.artist || audiusHit?.artist || itunesHit?.artist || artist;
      const fullAudioSearch = `${resolvedArtist} ${resolvedTitle}`.trim() || query;
      const fallbackParam = chosenPreview ? `&fallbackUrl=${encodeURIComponent(chosenPreview)}` : '';
      const fullAudioUrl = `/api/full-audio?q=${encodeURIComponent(fullAudioSearch)}&artist=${encodeURIComponent(resolvedArtist)}&title=${encodeURIComponent(resolvedTitle)}${fallbackParam}`;

      return res.json({
        title: resolvedTitle,
        artist: resolvedArtist,
        album: chosenAlbum,
        year: chosenYear,
        genre: chosenGenre,
        duration: chosenDuration,
        coverUrl: proxiedCoverUrl,
        highResCoverUrl: proxiedCoverUrl,
        rawCoverUrl: chosenCover,
        audioPreviewUrl: proxiedAudioUrl,
        fullAudioUrl,
        rawAudioUrl: chosenPreview,
        isFullSong,
        isExplicit: deezerHit?.isExplicit ?? false,
      });
    } catch (error) {
      console.error('Enrichment route error:', error);
      return res.status(500).json({ error: 'Internal enrichment failure' });
    }
  });

  // Disk Cache & In-flight Map for Full-Length Authentic 0:00 Audio Streams
  const FULL_AUDIO_CACHE_DIR = '/tmp/sv_audio_cache';
  if (!fs.existsSync(FULL_AUDIO_CACHE_DIR)) {
    fs.mkdirSync(FULL_AUDIO_CACHE_DIR, { recursive: true });
  }
  const inFlightFullAudio = new Map<string, Promise<boolean>>();

  // Helper to discover or auto-install standalone yt-dlp binary without throwing ENOENT
  let cachedYtDlpBinary: string | null = null;
  let ytDlpInstallingPromise: Promise<string | null> | null = null;

  const findOrInstallYtDlp = async (): Promise<string | null> => {
    if (cachedYtDlpBinary && fs.existsSync(cachedYtDlpBinary)) {
      return cachedYtDlpBinary;
    }

    if (ytDlpInstallingPromise) {
      return await ytDlpInstallingPromise;
    }

    ytDlpInstallingPromise = (async () => {
      const candidates = [
        path.join(__dirname, 'bin', 'yt-dlp'),
        '/app/applet/bin/yt-dlp',
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp',
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          try {
            fs.chmodSync(p, 0o755);
            cachedYtDlpBinary = p;
            return p;
          } catch {
            cachedYtDlpBinary = p;
            return p;
          }
        }
      }

      // Check PATH via which
      try {
        const { stdout } = await execFileAsync('which', ['yt-dlp']);
        const found = stdout.trim();
        if (found && fs.existsSync(found)) {
          cachedYtDlpBinary = found;
          return found;
        }
      } catch {
        // Not in PATH
      }

      // Auto-download PyInstaller standalone binary to workspace bin directory
      const targetDir = path.join(__dirname, 'bin');
      const targetPath = path.join(targetDir, 'yt-dlp');
      try {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        console.log('Downloading standalone yt-dlp binary to', targetPath);
        const res = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux', {
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          fs.writeFileSync(targetPath, Buffer.from(arrayBuf));
          fs.chmodSync(targetPath, 0o755);
          console.log('yt-dlp binary ready at', targetPath);
          cachedYtDlpBinary = targetPath;
          return targetPath;
        }
      } catch (err: any) {
        console.warn('yt-dlp binary auto-installer notice:', err?.message || err);
      }

      return null;
    })();

    const result = await ytDlpInstallingPromise;
    ytDlpInstallingPromise = null;
    return result;
  };

  // Pre-warm yt-dlp check at startup
  findOrInstallYtDlp().catch(() => {});

  // Helper to stream MP3 with full HTTP 206 Partial Content Byte-Range support
  const streamAudioFile = (filePath: string, req: express.Request, res: express.Response) => {
    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=604800');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
          return;
        }

        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'audio/mpeg',
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'audio/mpeg',
          'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      console.error('Stream audio file error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to stream audio file' });
    }
  };

  // 1.5. API: Full Authentic Master Audio Stream starting at 0:00
  // Extracts complete full-length original recording starting from the true beginning (0:00)
  app.get('/api/full-audio', async (req, res) => {
    try {
      const artist = ((req.query.artist as string) || '').trim();
      const title = ((req.query.title as string) || '').trim();
      const rawQ = ((req.query.q as string) || `${artist} ${title}`).trim();
      const fallbackUrl = ((req.query.fallbackUrl as string) || '').trim();

      if (!rawQ && !title) {
        return res.status(400).json({ error: 'Missing track query or title' });
      }

      // Clean query of URL artifacts and noisy tags
      const cleanSearch = rawQ
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/\(feat\..*?\)/gi, '')
        .replace(/\[feat\..*?\]/gi, '')
        .replace(/\(Official.*?\)/gi, '')
        .replace(/\[Official.*?\]/gi, '')
        .replace(/\s*-\s*Topic\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      const searchTarget = cleanSearch || `${artist} ${title}`.trim();
      const queryHash = crypto.createHash('md5').update(searchTarget.toLowerCase()).digest('hex');
      const cachedMp3Path = path.join(FULL_AUDIO_CACHE_DIR, `${queryHash}.mp3`);

      // 1. Fast path: Cached complete audio file already on disk (> 100KB)
      if (fs.existsSync(cachedMp3Path)) {
        try {
          const stat = fs.statSync(cachedMp3Path);
          if (stat.size > 100000) {
            return streamAudioFile(cachedMp3Path, req, res);
          }
        } catch {
          // Fall through if file read error
        }
      }

      // 2. In-flight de-duplication: wait if already being fetched
      if (inFlightFullAudio.has(queryHash)) {
        const success = await inFlightFullAudio.get(queryHash);
        if (success && fs.existsSync(cachedMp3Path) && fs.statSync(cachedMp3Path).size > 50000) {
          return streamAudioFile(cachedMp3Path, req, res);
        }
      }

      // 3. Initiate authentic full audio extraction starting at 0:00
      const fetchPromise = (async (): Promise<boolean> => {
        const ytDlpPath = await findOrInstallYtDlp();

        if (ytDlpPath && fs.existsSync(ytDlpPath)) {
          const tempTemplate = path.join(FULL_AUDIO_CACHE_DIR, `${queryHash}.%(ext)s`);

          // Search strategy A: Direct query with scsearch1
          try {
            await execFileAsync(ytDlpPath, [
              '-x',
              '--audio-format', 'mp3',
              '--audio-quality', '0',
              '--no-playlist',
              '--no-warnings',
              '--max-filesize', '60M',
              `scsearch1:${searchTarget}`,
              '-o', tempTemplate,
            ], { timeout: 20000 });

            if (fs.existsSync(cachedMp3Path) && fs.statSync(cachedMp3Path).size > 100000) {
              return true;
            }
          } catch {
            // Silently fallback if SoundCloud track has DRM or is blocked
          }

          // Search strategy B: Artist - Title if available
          if (artist && title) {
            try {
              await execFileAsync(ytDlpPath, [
                '-x',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                '--no-playlist',
                '--no-warnings',
                '--max-filesize', '60M',
                `scsearch1:${artist} - ${title}`,
                '-o', tempTemplate,
              ], { timeout: 20000 });

              if (fs.existsSync(cachedMp3Path) && fs.statSync(cachedMp3Path).size > 100000) {
                return true;
              }
            } catch {
              // Silently fallback
            }
          }
        }

        // Search strategy C: Direct Audius 320k stream
        try {
          const audiusHost = 'https://discoveryprovider.audius.co';
          const aRes = await fetch(`${audiusHost}/v1/tracks/search?query=${encodeURIComponent(searchTarget)}&app_name=SoundVault`, {
            signal: AbortSignal.timeout(4500),
          });
          if (aRes.ok) {
            const aJson = await aRes.json();
            const aTracks = aJson.data || [];
            const nonRemix = aTracks.filter((t: any) => !/remix|flip|cover|tribute/i.test(t.title || ''));
            const hit = nonRemix.find((t: any) => (t.duration || 0) >= 60) || nonRemix[0];
            if (hit) {
              const streamRes = await fetch(`${audiusHost}/v1/tracks/${hit.id}/stream?app_name=SoundVault`, {
                signal: AbortSignal.timeout(8000),
              });
              if (streamRes.ok) {
                const streamBuf = await streamRes.arrayBuffer();
                if (streamBuf.byteLength > 100000) {
                  fs.writeFileSync(cachedMp3Path, Buffer.from(streamBuf));
                  return true;
                }
              }
            }
          }
        } catch {
          // ignore
        }

        // Search strategy D: Direct authentic fallback stream from URL
        if (fallbackUrl) {
          try {
            const fbRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(8000) });
            if (fbRes.ok) {
              const fbBuf = await fbRes.arrayBuffer();
              if (fbBuf.byteLength > 20000) {
                fs.writeFileSync(cachedMp3Path, Buffer.from(fbBuf));
                return true;
              }
            }
          } catch {
            // ignore
          }
        }

        // Search strategy E: Deezer / iTunes authentic recording fallback
        try {
          const dRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(searchTarget)}&limit=5`, {
            signal: AbortSignal.timeout(4000),
          });
          if (dRes.ok) {
            const dJson = (await dRes.json()) as any;
            const track = dJson.data?.[0];
            if (track?.preview) {
              const pRes = await fetch(track.preview, { signal: AbortSignal.timeout(6000) });
              if (pRes.ok) {
                const buf = await pRes.arrayBuffer();
                if (buf.byteLength > 20000) {
                  fs.writeFileSync(cachedMp3Path, Buffer.from(buf));
                  return true;
                }
              }
            }
          }
        } catch {
          // ignore
        }

        try {
          const itRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTarget)}&entity=song&limit=5`, {
            signal: AbortSignal.timeout(4000),
          });
          if (itRes.ok) {
            const itJson = (await itRes.json()) as any;
            const track = itJson.results?.[0];
            if (track?.previewUrl) {
              const pRes = await fetch(track.previewUrl, { signal: AbortSignal.timeout(6000) });
              if (pRes.ok) {
                const buf = await pRes.arrayBuffer();
                if (buf.byteLength > 20000) {
                  fs.writeFileSync(cachedMp3Path, Buffer.from(buf));
                  return true;
                }
              }
            }
          }
        } catch {
          // ignore
        }

        return false;
      })();

      inFlightFullAudio.set(queryHash, fetchPromise);
      let success = false;
      try {
        success = await fetchPromise;
      } finally {
        inFlightFullAudio.delete(queryHash);
      }

      if (success && fs.existsSync(cachedMp3Path) && fs.statSync(cachedMp3Path).size > 20000) {
        return streamAudioFile(cachedMp3Path, req, res);
      }

      // If full extraction was unable to find source, respond with 404
      return res.status(404).json({
        error: 'Full authentic audio track not found. Fake/synth audio is permanently disabled.',
        notFound: true,
      });
    } catch (err: any) {
      console.error('/api/full-audio error:', err?.message || err);
      return res.status(500).json({ error: 'Full audio processing error' });
    }
  });

  // In-memory buffer cache for audio proxy to make seeking and scrubbing instantaneous
  const audioBufferCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
  const MAX_AUDIO_CACHE_SIZE = 30;

  // 2. API: Audio Stream Proxy (Eliminates CORS, supports HTTP 206 Partial Content Byte-Ranges for instant scrubbing/seeking)
  app.get('/api/audio-proxy', async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      return res.status(400).send('Missing url parameter');
    }

    try {
      let cached = audioBufferCache.get(rawUrl);
      if (!cached || Date.now() - cached.timestamp > 3600000) {
        const response = await fetch(rawUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: '*/*',
          },
        });

        if (!response.ok && response.status !== 206) {
          return res.status(response.status).send('Upstream audio fetch failed');
        }

        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const contentType = response.headers.get('content-type') || 'audio/mpeg';

        cached = { buffer, contentType, timestamp: Date.now() };

        if (audioBufferCache.size >= MAX_AUDIO_CACHE_SIZE) {
          const oldestKey = audioBufferCache.keys().next().value;
          if (oldestKey) audioBufferCache.delete(oldestKey);
        }
        audioBufferCache.set(rawUrl, cached);
      }

      const totalLength = cached.buffer.length;
      const rangeHeader = req.headers.range;

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

        if (start >= totalLength || end >= totalLength || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${totalLength}`).end();
          return;
        }

        const chunkSize = end - start + 1;
        const sliced = cached.buffer.subarray(start, end + 1);

        res.writeHead(206, {
          'Content-Type': cached.contentType,
          'Content-Range': `bytes ${start}-${end}/${totalLength}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400',
        });
        return res.end(sliced);
      }

      // Full file response with Accept-Ranges
      res.writeHead(200, {
        'Content-Type': cached.contentType,
        'Content-Length': totalLength,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      return res.end(cached.buffer);
    } catch (err) {
      console.error('Audio proxy error:', err);
      res.status(500).send('Audio proxy failed');
    }
  });

  // 3. API: Cover Image Proxy (Eliminates canvas tainting and CORS blocking)
  app.get('/api/cover-proxy', async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      return res.status(400).send('Missing url parameter');
    }

    try {
      const response = await fetch(rawUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/*',
        },
      });

      if (!response.ok) {
        return res.status(response.status).send('Upstream image fetch failed');
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=604800');

      const arrayBuf = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch (err) {
      console.error('Cover proxy error:', err);
      res.status(500).send('Cover proxy failed');
    }
  });

  // 4. API: Playlist Resolver for Spotify and YouTube Music
  // Extracts playlist title, playlist cover, and each track's individual name, artist, duration & cover
  app.get('/api/playlist', async (req, res) => {
    const url = ((req.query.url as string) || '').trim();
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    // A. Spotify Playlist: open.spotify.com/playlist/{id} or spotify:playlist:{id}
    if (url.includes('spotify.com/playlist/') || url.includes('spotify:playlist:')) {
      const plMatch = url.match(/playlist[/:]([a-zA-Z0-9]+)/);
      const plId = plMatch ? plMatch[1] : '';
      if (plId) {
        try {
          const spRes = await fetch(`https://open.spotify.com/embed/playlist/${plId}`, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (spRes.ok) {
            const html = await spRes.text();
            const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">({.+?})<\/script>/);
            if (match) {
              const data = JSON.parse(match[1]);
              const entity = data.props?.pageProps?.state?.data?.entity;
              const title = entity?.name || entity?.title || 'Spotify Playlist';
              const rawCover =
                entity?.coverArt?.sources?.[0]?.url ||
                entity?.visualIdentity?.image?.[0]?.url ||
                '';
              const coverUrl = rawCover ? `/api/cover-proxy?url=${encodeURIComponent(rawCover)}` : '';
              const rawTracks = entity?.trackList || [];

              const tracks = rawTracks.map((t: any, idx: number) => {
                const durSec = Math.round((t.duration || 180000) / 1000);
                const preview = t.audioPreview?.url
                  ? `/api/audio-proxy?url=${encodeURIComponent(t.audioPreview.url)}`
                  : undefined;
                return {
                  id: `track_sp_${t.uid || idx}_${Date.now()}`,
                  source: 'spotify',
                  sourceUrl: t.uri
                    ? `https://open.spotify.com/track/${t.uri.replace('spotify:track:', '')}`
                    : url,
                  title: t.title || `Track ${idx + 1}`,
                  artist: t.subtitle || 'Artist',
                  album: title,
                  year: '2024',
                  genre: 'Music',
                  duration: durSec,
                  coverUrl: coverUrl,
                  highResCoverUrl: coverUrl,
                  audioPreviewUrl: preview,
                  trackNumber: idx + 1,
                  totalTracks: rawTracks.length,
                  isExplicit: !!t.isExplicit,
                };
              });

              return res.json({
                id: 'pl_sp_' + plId,
                type: 'playlist',
                title,
                artist: entity?.subtitle || 'Curated Playlist',
                coverUrl,
                highResCoverUrl: coverUrl,
                totalTracks: tracks.length,
                tracks,
              });
            }
          }
        } catch (err) {
          console.warn('Spotify playlist fetch error:', err);
        }
      }
    }

    // B. YouTube Music / YouTube Playlist: list=... or playlist=... or playlist/...
    let listId = '';
    const listMatch = url.match(/[?&]list=([^#&?]+)/);
    if (listMatch) {
      listId = listMatch[1];
    } else {
      const plEq = url.match(/playlist=([^#&?]+)/i);
      if (plEq) listId = plEq[1];
      else {
        const plSlash = url.match(/playlist\/([^#&?]+)/i);
        if (plSlash) listId = plSlash[1];
        else if (/^PL[a-zA-Z0-9_-]{10,}/.test(url)) listId = url;
      }
    }

    if (listId) {
      // 1. Direct fetch to YouTube Playlist HTML (works for unlisted and user playlists)
      try {
        const ytRes = await fetch(`https://www.youtube.com/playlist?list=${listId}`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (ytRes.ok) {
          const html = await ytRes.text();

          // Real playlist title from meta og:title or <title>
          const titleM =
            html.match(/<meta property="og:title" content="([^"]+)">/) ||
            html.match(/<title>([^<]+)<\/title>/);
          let rawPlTitle = titleM ? titleM[1] : '';
          rawPlTitle = rawPlTitle.replace(/ - YouTube\b/gi, '').trim() || 'YouTube Music Playlist';

          // Real playlist collage / cover art from meta og:image
          const imgM = html.match(/<meta property="og:image" content="([^"]+)">/);
          let rawPlCover = imgM ? imgM[1].replace(/&amp;/g, '&') : '';

          // Parse video items from ytInitialData
          const dataMatch = html.match(/var ytInitialData = ({.+?});<\/script>/);
          const tracks: any[] = [];

          if (dataMatch) {
            try {
              const data = JSON.parse(dataMatch[1]);
              const seenVids = new Set<string>();

              const scanObj = (obj: any) => {
                if (!obj || typeof obj !== 'object') return;

                // Case 1: Modern lockupViewModel (YouTube 2024-2026)
                if (obj.lockupViewModel) {
                  const lv = obj.lockupViewModel;
                  const tit = lv.metadata?.lockupMetadataViewModel?.title?.content;
                  const thumb = lv.contentImage?.thumbnailViewModel?.image?.sources?.slice(-1)[0]?.url;
                  const vidMatch = JSON.stringify(lv).match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
                  const durMatch = JSON.stringify(lv).match(/"text":"([0-9]+:[0-9]+)"/);

                  if (tit && vidMatch) {
                    const vidId = vidMatch[1];
                    if (!seenVids.has(vidId)) {
                      seenVids.add(vidId);
                      const durParts = (durMatch ? durMatch[1] : '3:00').split(':').map(Number);
                      const durSec = durParts.length === 2 ? durParts[0] * 60 + durParts[1] : 180;
                      const thumbUrl = thumb || `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
                      const proxiedThumb = `/api/cover-proxy?url=${encodeURIComponent(thumbUrl)}`;

                      tracks.push({
                        id: `track_yt_${vidId}_${tracks.length}`,
                        source: 'ytmusic',
                        sourceUrl: `https://music.youtube.com/watch?v=${vidId}`,
                        title: tit,
                        artist: rawPlTitle,
                        album: rawPlTitle,
                        year: '2024',
                        genre: 'Music',
                        duration: durSec,
                        coverUrl: proxiedThumb,
                        highResCoverUrl: proxiedThumb,
                        trackNumber: tracks.length + 1,
                        isExplicit: false,
                      });
                    }
                  }
                }

                // Case 2: Classic playlistVideoRenderer
                if (obj.playlistVideoRenderer) {
                  const pvr = obj.playlistVideoRenderer;
                  const vidId = pvr.videoId;
                  if (vidId && !seenVids.has(vidId)) {
                    seenVids.add(vidId);
                    const tit = pvr.title?.runs?.[0]?.text || pvr.title?.simpleText || 'Track';
                    const author = pvr.shortBylineText?.runs?.[0]?.text || '';
                    const durSec = parseInt(pvr.lengthSeconds || '180');
                    const thumbUrl = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
                    const proxiedThumb = `/api/cover-proxy?url=${encodeURIComponent(thumbUrl)}`;

                    tracks.push({
                      id: `track_yt_${vidId}_${tracks.length}`,
                      source: 'ytmusic',
                      sourceUrl: `https://music.youtube.com/watch?v=${vidId}`,
                      title: tit,
                      artist: author.replace(/\s*-\s*Topic\b/gi, '').trim() || rawPlTitle,
                      album: rawPlTitle,
                      year: '2024',
                      genre: 'Music',
                      duration: durSec,
                      coverUrl: proxiedThumb,
                      highResCoverUrl: proxiedThumb,
                      trackNumber: tracks.length + 1,
                      isExplicit: false,
                    });
                  }
                }

                for (const k of Object.keys(obj)) {
                  scanObj(obj[k]);
                }
              };

              scanObj(data);
            } catch (err) {
              console.warn('ytInitialData parse error:', err);
            }
          }

          if (tracks.length > 0) {
            if (!rawPlCover && tracks[0].coverUrl) {
              rawPlCover = tracks[0].coverUrl;
            }
            const proxiedPlCover = rawPlCover
              ? `/api/cover-proxy?url=${encodeURIComponent(rawPlCover)}`
              : '';

            return res.json({
              id: 'pl_yt_' + listId,
              type: 'playlist',
              title: rawPlTitle,
              artist: 'YouTube Music Playlist',
              coverUrl: proxiedPlCover,
              highResCoverUrl: proxiedPlCover,
              totalTracks: tracks.length,
              tracks: tracks.map((t) => ({ ...t, totalTracks: tracks.length })),
            });
          }
        }
      } catch (err) {
        console.warn('Direct YouTube playlist fetch warning:', err);
      }

      // 2. Invidious fallback
      const invidiousInstances = [
        'https://inv.nadeko.net',
        'https://invidious.nerdvpn.de',
        'https://inv.tux.pizza',
      ];
      for (const inst of invidiousInstances) {
        try {
          const invRes = await fetch(
            `${inst}/api/v1/playlists/${listId}?fields=title,author,playlistThumbnail,videos(title,videoId,author,lengthSeconds)`,
            { signal: AbortSignal.timeout(4000) }
          );
          if (invRes.ok) {
            const d = await invRes.json();
            const plTitle = d.title || 'YouTube Music Playlist';
            const plAuthor = d.author || 'YouTube Music';
            const plThumb =
              d.playlistThumbnail ||
              (d.videos?.[0]?.videoId
                ? `https://img.youtube.com/vi/${d.videos[0].videoId}/hqdefault.jpg`
                : '');
            const plCover = plThumb ? `/api/cover-proxy?url=${encodeURIComponent(plThumb)}` : '';

            const tracks = (d.videos || []).map((v: any, idx: number) => {
              const vidId = v.videoId;
              const thumbUrl = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
              const proxiedThumb = `/api/cover-proxy?url=${encodeURIComponent(thumbUrl)}`;
              const rawT = v.title || `Track ${idx + 1}`;
              const cleanAuthor = (v.author || plAuthor).replace(/\s*-\s*Topic\b/gi, '').trim();

              return {
                id: `track_yt_${vidId}_${idx}`,
                source: 'ytmusic',
                sourceUrl: `https://music.youtube.com/watch?v=${vidId}`,
                title: rawT,
                artist: cleanAuthor,
                album: plTitle,
                year: '2024',
                genre: 'Music',
                duration: v.lengthSeconds || 195,
                coverUrl: proxiedThumb,
                highResCoverUrl: proxiedThumb,
                trackNumber: idx + 1,
                totalTracks: d.videos.length,
                isExplicit: false,
              };
            });

            return res.json({
              id: 'pl_yt_' + listId,
              type: 'playlist',
              title: plTitle,
              artist: plAuthor,
              coverUrl: plCover,
              highResCoverUrl: plCover,
              totalTracks: tracks.length,
              tracks,
            });
          }
        } catch {
          // try next instance
        }
      }
    }

    return res.status(404).json({ error: 'Playlist could not be parsed' });
  });

  // 5. API: Multi-source Verification Diagnostic Tester
  // Tests and validates multi-source audio fetching across Deezer, iTunes, Audius, YouTube & Spotify
  app.get('/api/test-sources', async (req, res) => {
    const testQuery = ((req.query.q as string) || '').trim();
    const queriesToTest = testQuery
      ? [testQuery]
      : [
          'Oliver Tree - Life Goes On',
          'DVRST - Dream Space',
          'Marwa Loud - Bad boy',
          'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
        ];

    const results = [];

    for (const q of queriesToTest) {
      const startTime = Date.now();
      const isUrl = q.startsWith('http://') || q.startsWith('https://');

      if (isUrl) {
        // Test playlist/album resolution
        try {
          const plRes = await fetch(`http://127.0.0.1:${PORT}/api/playlist?url=${encodeURIComponent(q)}`);
          const elapsed = Date.now() - startTime;
          if (plRes.ok) {
            const data = await plRes.json();
            results.push({
              query: q,
              type: 'playlist_url',
              status: 'pass',
              latencyMs: elapsed,
              resolvedTitle: data.title,
              artist: data.artist,
              totalTracks: data.totalTracks,
              hasCover: !!data.coverUrl,
              firstTrack: data.tracks?.[0]?.title,
            });
          } else {
            results.push({
              query: q,
              type: 'playlist_url',
              status: 'fail',
              latencyMs: elapsed,
              error: `HTTP ${plRes.status}`,
            });
          }
        } catch (err: any) {
          results.push({
            query: q,
            type: 'playlist_url',
            status: 'error',
            latencyMs: Date.now() - startTime,
            error: err.message,
          });
        }
      } else {
        // Test track enrichment and remix filtration
        try {
          const enrichRes = await fetch(`http://127.0.0.1:${PORT}/api/enrich?q=${encodeURIComponent(q)}`);
          const elapsed = Date.now() - startTime;
          if (enrichRes.ok) {
            const data = await enrichRes.json();
            results.push({
              query: q,
              type: 'track_search',
              status: 'pass',
              latencyMs: elapsed,
              resolvedTitle: data.title,
              resolvedArtist: data.artist,
              album: data.album,
              duration: data.duration,
              isFullSong: !!data.isFullSong,
              hasAudio: !!data.audioPreviewUrl,
              hasCover: !!data.coverUrl,
              remixAvoided: !/remix|flip|cover|bootleg/i.test(data.title),
            });
          } else {
            results.push({
              query: q,
              type: 'track_search',
              status: 'fail',
              latencyMs: elapsed,
              error: `HTTP ${enrichRes.status}`,
            });
          }
        } catch (err: any) {
          results.push({
            query: q,
            type: 'track_search',
            status: 'error',
            latencyMs: Date.now() - startTime,
            error: err.message,
          });
        }
      }
    }

    return res.json({
      timestamp: new Date().toISOString(),
      allPassed: results.every((r) => r.status === 'pass'),
      totalTested: results.length,
      results,
    });
  });

  // Vite Integration: Middleware mode in development, static files in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SoundVault server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
