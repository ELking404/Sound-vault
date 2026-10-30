import { MediaSource, TrackMetadata, AlbumOrPlaylist, ExternalDownloaderEngine } from '../types';

// Curated generated artwork paths from design skill
export const SAMPLE_ARTWORKS = {
  synthwave: '/src/assets/images/cover_cyberpunk_neon_1792357190693.jpg',
  folk: '/src/assets/images/cover_acoustic_folk_1792357192114.jpg',
  lofi: '/src/assets/images/cover_lofi_beats_1792357192167.jpg',
};

/**
 * Detects the media source platform from a URL or search text.
 */
export function detectMediaSource(input: string): MediaSource {
  const clean = input.trim().toLowerCase();
  if (clean.includes('music.youtube.com') || clean.includes('youtube.com') || clean.includes('youtu.be')) {
    return 'ytmusic';
  }
  if (clean.includes('spotify.com') || clean.startsWith('spotify:')) {
    return 'spotify';
  }
  return 'manual';
}

/**
 * Bulletproof extraction of YouTube 11-character video ID.
 * Accurately parses YouTube Music, standard YouTube, youtu.be, shorts, embeds,
 * regardless of parameter order (e.g. ?si=...&v=... or ?v=...&list=...).
 */
export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. Raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Standard URL parsing
  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = urlObj.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      // youtu.be/ID
      if (host.includes('youtu.be')) {
        const pathPart = urlObj.pathname.replace(/^\/+/, '').split('/')[0].split('?')[0];
        if (pathPart && /^[a-zA-Z0-9_-]{11}$/.test(pathPart)) {
          return pathPart;
        }
      }

      // Query param v=ID
      const v = urlObj.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v;
      }

      // Path segments like /embed/ID, /shorts/ID, /v/ID, /live/ID
      const segments = urlObj.pathname.split('/').filter(Boolean);
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i].toLowerCase();
        if (['embed', 'v', 'shorts', 'live'].includes(seg) && segments[i + 1]) {
          const candidate = segments[i + 1].split('?')[0];
          if (/^[a-zA-Z0-9_-]{11}$/.test(candidate)) {
            return candidate;
          }
        }
      }
    }
  } catch {
    // URL parsing failed, fall through to regex
  }

  // 3. Fallback regexes
  const vMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (vMatch) return vMatch[1];

  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  const pathMatch = trimmed.match(/(?:embed|v|shorts|live)\/([a-zA-Z0-9_-]{11})/);
  if (pathMatch) return pathMatch[1];

  return null;
}

/**
 * Extracts a YouTube playlist ID from a URL.
 */
export function extractYouTubePlaylistId(url: string): string | null {
  const clean = url.trim();
  const listMatch = clean.match(/[?&]list=([^#&?]+)/);
  if (listMatch) return listMatch[1];
  const plEqMatch = clean.match(/playlist=([^#&?]+)/i);
  if (plEqMatch) return plEqMatch[1];
  const plSlashMatch = clean.match(/playlist\/([^#&?]+)/i);
  if (plSlashMatch) return plSlashMatch[1];
  if (/^PL[a-zA-Z0-9_-]{10,}/.test(clean)) return clean;
  return null;
}

/**
 * Determines whether the input is an Album or Playlist URL.
 * CRITICAL: If the URL has an explicit single video ID (e.g. watch?v=... or youtu.be/...),
 * it is treated as a SINGLE TRACK. YouTube Music always appends &list=RDAMVM... (radio mix)
 * to single song links, which previously caused single tracks to be mistakenly treated as playlists!
 */
export function isAlbumOrPlaylistUrl(input: string): boolean {
  const clean = input.trim().toLowerCase();

  // If a single video ID is found, it is a single song!
  if (extractYouTubeId(input)) {
    return false;
  }

  // YouTube playlist ID detected
  if (extractYouTubePlaylistId(input)) {
    return true;
  }

  // Spotify Albums and Playlists
  if (clean.includes('spotify.com/album/') || clean.startsWith('spotify:album:')) {
    return true;
  }
  if (clean.includes('spotify.com/playlist/') || clean.startsWith('spotify:playlist:')) {
    return true;
  }

  // YouTube / YT Music explicit playlist pages (without a video ID)
  if (clean.includes('music.youtube.com/playlist') || clean.includes('youtube.com/playlist') || clean.includes('playlist=')) {
    return true;
  }

  // Apple Music albums
  if (clean.includes('music.apple.com/') && clean.includes('/album/')) {
    return true;
  }

  // Explicit user prefixes
  if (clean.startsWith('album:') || clean.startsWith('playlist:')) {
    return true;
  }

  return false;
}

/**
 * Sanitizes channel and author names from YouTube / YouTube Music.
 * Strips auto-generated suffixes like " - Topic", "Official", "VEVO", etc.
 */
export function cleanArtistName(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\s*-\s*Topic\b/gi, '')
    .replace(/\s*–\s*Topic\b/gi, '')
    .replace(/\bOfficial\s*(Channel|Music|Video|Audio)?\b/gi, '')
    .replace(/\bVEVO\b/gi, '')
    .replace(/\bRecords\b/gi, '')
    .replace(/\s*-\s*Official\b/gi, '')
    .trim();
}

/**
 * Parses raw video title and channel name into clean { artist, title }.
 * Handles:
 * - "Artist - Song (Official Video)"
 * - "Artist – Song"
 * - "Song" with channel "Artist - Topic" (standard YouTube Music releases)
 */
export function cleanTrackTitle(raw: string, fallbackAuthor?: string): { artist: string; title: string } {
  let s = raw
    // Strip common metadata noise
    .replace(/\[(Official Video|Official Audio|Music Video|Audio|Lyric Video|4K|Remastered|4K Remaster|HD|HQ|Visualizer|Exclusive|Audio Video)\]/gi, '')
    .replace(/\((Official Video|Official Audio|Music Video|Audio|Lyric Video|4K|Remastered|4K Remaster|HD|HQ|Visualizer|Official Music Video)\)/gi, '')
    .replace(/\|.*$/g, '')
    .trim();

  // Case 1: Title contains "Artist - Song"
  if (s.includes(' - ')) {
    const parts = s.split(' - ');
    const candidateArtist = cleanArtistName(parts[0].trim());
    const candidateTitle = parts.slice(1).join(' - ').replace(/\(Official.*?\)/gi, '').trim();
    return {
      artist: candidateArtist || cleanArtistName(fallbackAuthor || '') || 'Unknown Artist',
      title: candidateTitle || s,
    };
  }

  // Case 2: Title contains "Artist – Song" (en-dash)
  if (s.includes(' – ')) {
    const parts = s.split(' – ');
    const candidateArtist = cleanArtistName(parts[0].trim());
    const candidateTitle = parts.slice(1).join(' – ').replace(/\(Official.*?\)/gi, '').trim();
    return {
      artist: candidateArtist || cleanArtistName(fallbackAuthor || '') || 'Unknown Artist',
      title: candidateTitle || s,
    };
  }

  // Case 3: Title contains "Artist: Song"
  if (s.includes(':') && !s.includes('http')) {
    const parts = s.split(':');
    if (parts[0].length < 30) {
      const candidateArtist = cleanArtistName(parts[0].trim());
      const candidateTitle = parts.slice(1).join(':').trim();
      return {
        artist: candidateArtist || cleanArtistName(fallbackAuthor || '') || 'Unknown Artist',
        title: candidateTitle || s,
      };
    }
  }

  // Case 4: No separator (typical for YouTube Music official releases, e.g. Title: "Starboy", Channel: "The Weeknd - Topic")
  const author = cleanArtistName(fallbackAuthor || '');
  return {
    artist: author || 'Unknown Artist',
    title: s,
  };
}

function scoreCandidate(item: { trackName?: string; artistName?: string }, targetTitle: string, targetArtist: string): number {
  if (!item.trackName) return -1;
  const itemTitle = item.trackName.toLowerCase().trim();
  const targetTit = targetTitle.toLowerCase().trim();
  const itemArt = (item.artistName || '').toLowerCase().trim();
  const targetArt = targetArtist.toLowerCase().trim();

  // If target artist is known, candidate MUST match the artist!
  // If artist does not match, return -1 immediately so we NEVER match the wrong artist!
  if (targetArt && targetArt !== 'unknown artist' && targetArt !== 'various artists') {
    const artistMatches = itemArt === targetArt || itemArt.includes(targetArt) || targetArt.includes(itemArt);
    if (!artistMatches) {
      return -1;
    }
  }

  let score = 0;
  // Exact title match: huge bonus
  if (itemTitle === targetTit) score += 50;
  else if (itemTitle.startsWith(targetTit) || targetTit.startsWith(itemTitle)) score += 35;
  else if (itemTitle.includes(targetTit) || targetTit.includes(itemTitle)) score += 25;

  // Artist match bonus
  if (itemArt === targetArt) score += 30;
  else if (itemArt.includes(targetArt) || targetArt.includes(itemArt)) score += 20;

  // Penalize remixes, live, acoustic if target did not specify them
  if (!targetTit.includes('remix') && itemTitle.includes('remix')) score -= 25;
  if (!targetTit.includes('live') && itemTitle.includes('live')) score -= 20;
  if (!targetTit.includes('acoustic') && itemTitle.includes('acoustic')) score -= 15;

  return score;
}

/**
 * Automatically fetches the exact duration of a YouTube / YouTube Music video
 * using client-side YouTube IFrame API or player event.
 */
export function fetchYouTubeDuration(videoId: string): Promise<number | null> {
  if (typeof window === 'undefined' || !videoId) return Promise.resolve(null);

  return new Promise((resolve) => {
    let finished = false;
    const finish = (dur: number | null) => {
      if (!finished) {
        finished = true;
        resolve(dur);
      }
    };

    // Safety timeout: 3.5 seconds max
    const timer = setTimeout(() => finish(null), 3500);

    const initPlayer = () => {
      try {
        const div = document.createElement('div');
        div.id = `yt_dur_${videoId}_${Date.now()}`;
        div.style.position = 'absolute';
        div.style.left = '-9999px';
        div.style.top = '-9999px';
        div.style.width = '1px';
        div.style.height = '1px';
        div.style.opacity = '0';
        div.style.pointerEvents = 'none';
        document.body.appendChild(div);

        new (window as unknown as { YT: { Player: new (id: string, opts: unknown) => { destroy: () => void } } }).YT.Player(div.id, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event: { target: { getDuration: () => number; destroy: () => void } }) => {
              try {
                const d = event.target.getDuration();
                try {
                  event.target.destroy();
                } catch {
                  // ignore
                }
                if (div.parentNode) div.parentNode.removeChild(div);
                clearTimeout(timer);
                if (typeof d === 'number' && d > 0) {
                  finish(Math.round(d));
                } else {
                  finish(null);
                }
              } catch {
                finish(null);
              }
            },
            onError: () => {
              try {
                if (div.parentNode) div.parentNode.removeChild(div);
              } catch {
                // ignore
              }
              clearTimeout(timer);
              finish(null);
            },
          },
        });
      } catch {
        clearTimeout(timer);
        finish(null);
      }
    };

    const win = window as unknown as { YT?: { Player?: unknown }; onYouTubeIframeAPIReady?: () => void };
    if (win.YT && win.YT.Player) {
      initPlayer();
    } else {
      const existing = document.getElementById('yt-iframe-api-script');
      if (!existing) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }

      const prev = win.onYouTubeIframeAPIReady;
      win.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev();
        initPlayer();
      };
    }
  });
}

/**
 * Queries iTunes API for high-resolution metadata and official audio preview.
 * Strictly verifies matches and ranks candidates to ensure the exact song is returned.
 */
export async function searchITunesEnrichment(artist: string, title: string): Promise<Partial<TrackMetadata> | null> {
  const cleanArt = cleanArtistName(artist);
  const cleanTit = title
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\[feat\..*?\]/gi, '')
    .replace(/\(with.*?\)/gi, '')
    .replace(/\[with.*?\]/gi, '')
    .replace(/ - Single$/i, '')
    .replace(/ - EP$/i, '')
    .trim();

  if (!cleanTit) return null;

  try {
    // Only search combined artist + title. Never search title-only if artist is known to avoid wrong songs!
    const searchTerm = cleanArt && cleanArt !== 'unknown artist' ? `${cleanArt} ${cleanTit}` : cleanTit;
    const query = encodeURIComponent(searchTerm.trim());
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=10`);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        // Score candidates and pick best matching track
        const scored = (data.results as Array<{
          trackName?: string;
          artistName?: string;
          collectionName?: string;
          releaseDate?: string;
          primaryGenreName?: string;
          trackTimeMillis?: number;
          artworkUrl100?: string;
          previewUrl?: string;
          trackExplicitness?: string;
          trackNumber?: number;
          trackCount?: number;
        }>)
          .map(item => ({ item, score: scoreCandidate(item, cleanTit, cleanArt) }))
          .filter(c => c.score >= 40) // Must solidly match artist and title
          .sort((a, b) => b.score - a.score);

        if (scored.length > 0) {
          const item = scored[0].item;
          const rawArt = item.artworkUrl100 || '';
          const highResArt = rawArt ? rawArt.replace('100x100bb', '1400x1400bb') : '';
          return {
            title: item.trackName || title,
            artist: item.artistName || artist,
            album: item.collectionName || 'Single',
            year: item.releaseDate ? new Date(item.releaseDate).getFullYear().toString() : '2024',
            genre: item.primaryGenreName || 'Music',
            duration: Math.round((item.trackTimeMillis || 180000) / 1000),
            highResCoverUrl: highResArt,
            coverUrl: highResArt || rawArt,
            audioPreviewUrl: item.previewUrl || undefined,
            isExplicit: item.trackExplicitness === 'explicit',
            trackNumber: item.trackNumber,
            totalTracks: item.trackCount,
          };
        }
      }
    }
  } catch (err) {
    console.warn('iTunes enrichment failed:', err);
  }

  return null;
}

/**
 * Master multi-source music enrichment.
 * Queries the server endpoint (/api/enrich) which combines Deezer and iTunes with zero CORS issues,
 * delivering authentic audio recordings and high-resolution 1000x1000/1400x1400 cover art.
 */
export async function enrichMusicMetadata(artist: string, title: string, sourceUrl?: string): Promise<Partial<TrackMetadata> | null> {
  const cleanArt = cleanArtistName(artist);
  const cleanTit = title
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\[feat\..*?\]/gi, '')
    .replace(/\(with.*?\)/gi, '')
    .replace(/\[with.*?\]/gi, '')
    .replace(/ - Single$/i, '')
    .replace(/ - EP$/i, '')
    .trim();

  // 1. Try server-side Multi-Source Enrichment (Spotify Embed, Audius, Deezer, Multi-country iTunes)
  try {
    const params = new URLSearchParams();
    if (cleanArt && cleanArt !== 'unknown artist') params.set('artist', cleanArt);
    if (cleanTit) params.set('title', cleanTit);
    if (sourceUrl) params.set('url', sourceUrl);
    params.set('q', sourceUrl || `${cleanArt} ${cleanTit}`.trim());

    const res = await fetch(`/api/enrich?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.audioPreviewUrl || data.coverUrl || data.fullAudioUrl)) {
        return {
          title: data.title || cleanTit,
          artist: data.artist || cleanArt,
          album: data.album || 'Single',
          year: data.year || '2024',
          genre: data.genre || 'Music',
          duration: data.duration || 180,
          coverUrl: data.coverUrl,
          highResCoverUrl: data.highResCoverUrl || data.coverUrl,
          audioPreviewUrl: data.audioPreviewUrl,
          fullAudioUrl: data.fullAudioUrl,
          isExplicit: data.isExplicit ?? false,
        };
      }
    }
  } catch (err) {
    console.warn('Backend enrichment route unreachable, falling back to client-side:', err);
  }

  // 2. Client-side iTunes fallback
  return searchITunesEnrichment(cleanArt, cleanTit);
}

/**
 * Resolves a YouTube Music track with multi-layered API resilience.
 * Guarantees that the true song title, artist, and cover are returned without misidentification.
 */
export async function resolveYouTubeTrack(
  videoId: string,
  originalUrl: string
): Promise<TrackMetadata> {
  const trackId = `track_ytm_${videoId}_${Date.now()}`;
  const ytThumbMax = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const ytThumbHq = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  let rawTitle = '';
  let rawAuthor = '';

  // 1. YouTube Music Official oEmbed API
  // Always query with canonical https://www.youtube.com/watch?v=ID format
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.title) rawTitle = data.title;
      if (data.author_name) rawAuthor = data.author_name;
    }
  } catch {
    // fallback to secondary
  }

  // 2. Secondary oEmbed Fallback (noembed)
  if (!rawTitle) {
    try {
      const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
      const res = await fetch(noembedUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.title) rawTitle = data.title;
        if (data.author_name) rawAuthor = data.author_name;
      }
    } catch {
      // fallback
    }
  }

  // Parse title and artist cleanly from YouTube Music
  const parsed = cleanTrackTitle(rawTitle || 'YouTube Music Track', rawAuthor);
  const songTitle = parsed.title;
  const songArtist = parsed.artist;

  // 3. Auto-fetch duration and enrich with verified Spotify Embed, Deezer, and iTunes authentic audio and covers
  const [ytDuration, enrichment] = await Promise.all([
    fetchYouTubeDuration(videoId),
    enrichMusicMetadata(songArtist, songTitle, originalUrl),
  ]);

  const resolvedDuration = ytDuration || enrichment?.duration || 214;
  const fullAudioSearch = `${songArtist} ${songTitle}`.trim();

  // CRITICAL: ALWAYS PRESERVE YouTube Music's exact title and artist!
  // Take authentic high-res cover, real audio recording preview, and full audio master.
  return {
    id: trackId,
    source: 'ytmusic',
    sourceUrl: originalUrl.includes('music.youtube.com') ? originalUrl : `https://music.youtube.com/watch?v=${videoId}`,
    title: songTitle,
    artist: songArtist,
    album: enrichment?.album || 'YouTube Music Single',
    year: enrichment?.year || new Date().getFullYear().toString(),
    genre: enrichment?.genre || 'Music',
    duration: resolvedDuration,
    coverUrl: enrichment?.highResCoverUrl || ytThumbMax || ytThumbHq,
    highResCoverUrl: enrichment?.highResCoverUrl || ytThumbMax || ytThumbHq,
    audioPreviewUrl: enrichment?.audioPreviewUrl,
    fullAudioUrl: enrichment?.fullAudioUrl || `/api/full-audio?q=${encodeURIComponent(fullAudioSearch)}&artist=${encodeURIComponent(songArtist)}&title=${encodeURIComponent(songTitle)}`,
    isExplicit: enrichment?.isExplicit ?? false,
    trackNumber: enrichment?.trackNumber,
    totalTracks: enrichment?.totalTracks,
  };
}

/**
 * Resolves a full album or playlist URL into an AlbumOrPlaylist object with complete tracklist.
 */
export async function resolveAlbumOrPlaylist(input: string): Promise<AlbumOrPlaylist> {
  const trimmed = input.trim();
  const source = detectMediaSource(trimmed);
  const albumId = 'col_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  const isPlaylist = trimmed.toLowerCase().includes('playlist') || trimmed.toLowerCase().includes('list=') || trimmed.startsWith('playlist:');

  // 1. Try server-side playlist resolver (Spotify embed & YouTube Invidious)
  try {
    const plRes = await fetch(`/api/playlist?url=${encodeURIComponent(trimmed)}`);
    if (plRes.ok) {
      const plData = await plRes.json();
      if (plData && plData.tracks && plData.tracks.length > 0) {
        return plData;
      }
    }
  } catch (err) {
    console.warn('Backend playlist resolver unreachable, using fallback:', err);
  }

  // 2. Spotify Album or Playlist Fallback
  if (source === 'spotify') {
    let title = isPlaylist ? 'Spotify Playlist' : 'Spotify Album';
    let artist = isPlaylist ? 'Curated Playlist' : 'Featured Artist';
    let coverUrl = SAMPLE_ARTWORKS.synthwave;

    try {
      const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(trimmed)}`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (oembedData.title) {
          const raw = oembedData.title;
          if (raw.includes(' by ')) {
            const parts = raw.split(' by ');
            title = parts[0].trim();
            artist = parts[1].trim();
          } else {
            title = raw;
          }
        }
        if (oembedData.thumbnail_url) {
          coverUrl = oembedData.thumbnail_url;
        }
      }
    } catch {
      // fallback
    }

    // Try finding full tracklist via iTunes album lookup
    try {
      const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(title + ' ' + artist)}&entity=album&limit=1`);
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        if (searchJson.results && searchJson.results.length > 0) {
          const colId = searchJson.results[0].collectionId;
          const highResArt = (searchJson.results[0].artworkUrl100 || '').replace('100x100bb', '1400x1400bb') || coverUrl;
          const genre = searchJson.results[0].primaryGenreName || 'Pop';
          const year = searchJson.results[0].releaseDate ? new Date(searchJson.results[0].releaseDate).getFullYear().toString() : '2024';

          const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${colId}&entity=song`);
          if (lookupRes.ok) {
            const lookupJson = await lookupRes.json();
            const songResults = (lookupJson.results || []).filter((r: { wrapperType?: string }) => r.wrapperType === 'track');
            if (songResults.length > 0) {
              const tracks: TrackMetadata[] = songResults.map((s: {
                trackId: number;
                trackName: string;
                artistName: string;
                collectionName: string;
                trackNumber?: number;
                trackTimeMillis?: number;
                previewUrl?: string;
                trackExplicitness?: string;
              }, idx: number) => ({
                id: `track_${s.trackId || idx}_${Date.now()}`,
                source: 'spotify',
                sourceUrl: trimmed,
                title: s.trackName,
                artist: s.artistName || artist,
                album: s.collectionName || title,
                year,
                genre,
                duration: Math.round((s.trackTimeMillis || 190000) / 1000),
                coverUrl: highResArt,
                highResCoverUrl: highResArt,
                audioPreviewUrl: s.previewUrl,
                isExplicit: s.trackExplicitness === 'explicit',
                trackNumber: s.trackNumber || (idx + 1),
                totalTracks: songResults.length,
              }));

              return {
                id: albumId,
                type: isPlaylist ? 'playlist' : 'album',
                title: searchJson.results[0].collectionName || title,
                artist: searchJson.results[0].artistName || artist,
                source: 'spotify',
                sourceUrl: trimmed,
                coverUrl: highResArt,
                highResCoverUrl: highResArt,
                year,
                genre,
                totalTracks: tracks.length,
                tracks,
              };
            }
          }
        }
      }
    } catch {
      // fallback
    }
  }

  // 2. Query iTunes for search terms or album name
  const cleanSearch = trimmed.replace(/^(album:|playlist:)/i, '').trim();
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanSearch)}&entity=album&limit=1`);
    if (res.ok) {
      const json = await res.json();
      if (json.results && json.results.length > 0) {
        const col = json.results[0];
        const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${col.collectionId}&entity=song`);
        if (lookupRes.ok) {
          const lJson = await lookupRes.json();
          const songs = (lJson.results || []).filter((r: { wrapperType?: string }) => r.wrapperType === 'track');
          const highResArt = (col.artworkUrl100 || '').replace('100x100bb', '1400x1400bb');
          const tracks: TrackMetadata[] = songs.map((s: {
            trackId: number;
            trackName: string;
            artistName: string;
            collectionName: string;
            trackNumber?: number;
            trackTimeMillis?: number;
            previewUrl?: string;
            primaryGenreName?: string;
          }, idx: number) => ({
            id: `track_${s.trackId || idx}_${Date.now()}`,
            source: 'manual',
            sourceUrl: trimmed,
            title: s.trackName,
            artist: s.artistName || col.artistName,
            album: col.collectionName,
            year: col.releaseDate ? new Date(col.releaseDate).getFullYear().toString() : '2024',
            genre: s.primaryGenreName || col.primaryGenreName || 'Music',
            duration: Math.round((s.trackTimeMillis || 180000) / 1000),
            coverUrl: highResArt,
            highResCoverUrl: highResArt,
            audioPreviewUrl: s.previewUrl,
            trackNumber: s.trackNumber || idx + 1,
            totalTracks: songs.length,
          }));

          return {
            id: albumId,
            type: 'album',
            title: col.collectionName,
            artist: col.artistName,
            source: 'manual',
            sourceUrl: trimmed,
            coverUrl: highResArt,
            highResCoverUrl: highResArt,
            year: col.releaseDate ? new Date(col.releaseDate).getFullYear().toString() : '2024',
            genre: col.primaryGenreName || 'Music',
            totalTracks: tracks.length,
            tracks,
          };
        }
      }
    }
  } catch {
    // fallback
  }

  // Clean empty state if not found, allowing user to view and customize
  return {
    id: albumId,
    type: isPlaylist ? 'playlist' : 'album',
    title: cleanSearch || 'Audio Master Collection',
    artist: 'Various Artists',
    source: 'manual',
    sourceUrl: trimmed,
    coverUrl: SAMPLE_ARTWORKS.synthwave,
    highResCoverUrl: SAMPLE_ARTWORKS.synthwave,
    year: new Date().getFullYear().toString(),
    genre: 'Music',
    totalTracks: 0,
    tracks: [],
  };
}

/**
 * Resolves a single audio track URL or title into TrackMetadata.
 * Always returns a completely new unique ID and avoids any stale caching.
 */
export async function resolveMetadata(input: string): Promise<TrackMetadata> {
  const trimmed = input.trim();
  const source = detectMediaSource(trimmed);
  const trackId = 'track_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

  // 1. YouTube Music Track
  if (source === 'ytmusic') {
    const videoId = extractYouTubeId(trimmed);
    if (videoId) {
      return await resolveYouTubeTrack(videoId, trimmed);
    }
  }

  // 2. Spotify Single Track
  if (source === 'spotify') {
    let spotifyTitle = 'Spotify Track';
    let spotifyArtist = 'Spotify Artist';
    let spotifyCover = SAMPLE_ARTWORKS.synthwave;

    try {
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(trimmed)}`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.title) {
          spotifyTitle = data.title;
        }
        if (data.thumbnail_url) {
          spotifyCover = data.thumbnail_url;
        }
      }
    } catch {
      // fallback
    }

    const parsed = cleanTrackTitle(spotifyTitle);
    const finalArtist = parsed.artist !== 'Unknown Artist' ? parsed.artist : spotifyArtist;
    const finalTitle = parsed.title || spotifyTitle;

    const enrichment = await enrichMusicMetadata(finalArtist, finalTitle, trimmed);

    return {
      id: trackId,
      source: 'spotify',
      sourceUrl: trimmed,
      title: enrichment?.title || finalTitle,
      artist: enrichment?.artist || finalArtist,
      album: enrichment?.album || 'Spotify Single',
      year: enrichment?.year || '2024',
      genre: enrichment?.genre || 'Pop',
      duration: enrichment?.duration || 195,
      coverUrl: enrichment?.highResCoverUrl || spotifyCover,
      highResCoverUrl: enrichment?.highResCoverUrl || spotifyCover,
      audioPreviewUrl: enrichment?.audioPreviewUrl,
      fullAudioUrl: enrichment?.fullAudioUrl || `/api/full-audio?q=${encodeURIComponent(`${finalArtist} ${finalTitle}`)}&artist=${encodeURIComponent(finalArtist)}&title=${encodeURIComponent(finalTitle)}`,
      isExplicit: enrichment?.isExplicit ?? false,
      trackNumber: enrichment?.trackNumber,
      totalTracks: enrichment?.totalTracks,
    };
  }

  // 3. Manual Song Search / Title Query
  const parsed = cleanTrackTitle(trimmed);
  const cleanMArtist = parsed.artist !== 'Unknown Artist' ? parsed.artist : '';
  const enrichment = await enrichMusicMetadata(cleanMArtist, parsed.title);
  const mTitle = enrichment?.title || parsed.title || trimmed;
  const mArtist = enrichment?.artist || (cleanMArtist || 'Featured Artist');
  const mSearch = `${mArtist} ${mTitle}`.trim();

  if (enrichment) {
    return {
      id: trackId,
      source: 'manual',
      sourceUrl: trimmed,
      title: mTitle,
      artist: mArtist,
      album: enrichment.album || 'Single',
      year: enrichment.year || '2024',
      genre: enrichment.genre || 'Electronic',
      duration: enrichment.duration || 180,
      coverUrl: enrichment.highResCoverUrl || SAMPLE_ARTWORKS.synthwave,
      highResCoverUrl: enrichment.highResCoverUrl || SAMPLE_ARTWORKS.synthwave,
      audioPreviewUrl: enrichment.audioPreviewUrl,
      fullAudioUrl: enrichment.fullAudioUrl || `/api/full-audio?q=${encodeURIComponent(mSearch)}&artist=${encodeURIComponent(mArtist)}&title=${encodeURIComponent(mTitle)}`,
      isExplicit: enrichment.isExplicit ?? false,
      trackNumber: enrichment.trackNumber,
      totalTracks: enrichment.totalTracks,
    };
  }

  // Clean fallback when offline or no API match found
  return {
    id: trackId,
    source: 'manual',
    sourceUrl: trimmed,
    title: parsed.title || trimmed,
    artist: parsed.artist !== 'Unknown Artist' ? parsed.artist : 'Artist',
    album: 'Single',
    year: new Date().getFullYear().toString(),
    genre: 'Music',
    duration: 198,
    coverUrl: SAMPLE_ARTWORKS.synthwave,
    highResCoverUrl: SAMPLE_ARTWORKS.synthwave,
    isExplicit: false,
  };
}

/**
 * Generates direct one-click links to the leading music download websites and engines
 * pre-filled with the exact track URL or ID.
 */
export function getExternalDownloaderEngines(track: TrackMetadata): ExternalDownloaderEngine[] {
  const isYt = track.source === 'ytmusic' || track.sourceUrl.includes('youtube.com') || track.sourceUrl.includes('youtu.be');
  const ytid = extractYouTubeId(track.sourceUrl);

  if (isYt && ytid) {
    const canonicalYt = `https://www.youtube.com/watch?v=${ytid}`;
    return [
      {
        name: 'Dirpy Studio',
        url: `https://dirpy.com/studio?url=${encodeURIComponent(canonicalYt)}`,
        description: 'Direct 320kbps full MP3 conversion with original ID3 tags & full length',
        badge: 'Recommended · 320 kbps',
        color: 'emerald',
      },
      {
        name: 'OnlyMP3 Converter',
        url: `https://en.onlymp3.to/`,
        description: 'Clean, instant YouTube Music to MP3 downloader',
        badge: 'Fast & Ad-Free',
        color: 'indigo',
      },
      {
        name: 'Y2Mate Engine',
        url: `https://www.y2mate.com/youtube/${ytid}`,
        description: 'High-speed audio downloader with quality selector',
        badge: 'High Speed',
        color: 'rose',
      },
      {
        name: 'Cobalt Media Tools',
        url: `https://cobalt.tools/`,
        description: 'Open-source, privacy-first full song converter',
        badge: 'Open Source',
        color: 'sky',
      },
    ];
  }

  // Spotify
  return [
    {
      name: 'SpotifyDown',
      url: `https://spotifydown.com/`,
      description: 'Dedicated full-song MP3 downloader for Spotify tracks and albums',
      badge: 'Recommended for Spotify',
      color: 'emerald',
    },
    {
      name: 'SpotiSongDownloader',
      url: `https://spotisongdownloader.com/`,
      description: 'High-quality 320kbps MP3 downloader with album artwork',
      badge: 'Full Song 320k',
      color: 'indigo',
    },
    {
      name: 'Spotmate',
      url: `https://spotmate.online/`,
      description: 'Online Spotify song, album, and playlist downloader',
      badge: 'Direct Portal',
      color: 'sky',
    },
  ];
}
