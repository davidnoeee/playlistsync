export interface AppleMusicTrack {
  name: string;
  artist: string;
  album: string;
}

export interface AppleMusicPlaylist {
  name: string;
  curator: string;
  tracks: AppleMusicTrack[];
}

const APPLE_MUSIC_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Extract the playlist ID and storefront from an Apple Music playlist URL.
 * Supports formats like:
 *   https://music.apple.com/us/playlist/playlist-name/pl.xxxx
 *   https://music.apple.com/us/playlist/pl.xxxx
 */
export function parseAppleMusicUrl(url: string): {
  storefront: string;
  playlistId: string;
} | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname !== "music.apple.com" &&
      !parsed.hostname.endsWith(".music.apple.com")
    ) {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    // segments: [storefront, "playlist", name?, id] or [storefront, "playlist", id]
    const playlistIdx = segments.indexOf("playlist");
    if (playlistIdx === -1) return null;

    const storefront = segments[0] || "us";
    // The playlist ID is always the last segment and starts with "pl."
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.startsWith("pl.")) {
      return { storefront, playlistId: lastSegment };
    }

    // Sometimes the URL has a query param `i` or the ID is differently placed
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch a bearer token from Apple Music's web app.
 * Apple embeds a JWT token in its web page that grants read-only API access.
 */
async function fetchAppleMusicToken(): Promise<string> {
  const res = await fetch("https://music.apple.com/us/browse", {
    headers: { "User-Agent": APPLE_MUSIC_USER_AGENT },
  });
  const html = await res.text();

  // Look for the token in meta tag
  const metaMatch = html.match(
    /name="desktop-music-app\/config\/environment"\s+content="([^"]+)"/
  );
  if (metaMatch) {
    const decoded = decodeURIComponent(metaMatch[1]);
    const config = JSON.parse(decoded);
    const token =
      config?.MEDIA_API?.token ||
      config?.MEDIA_API?.ttul?.token;
    if (token) return token;
  }

  // Fallback: look for token in JS bundles
  const jsMatch = html.match(/src="(\/assets\/index[^"]+\.js)"/);
  if (jsMatch) {
    const jsRes = await fetch(`https://music.apple.com${jsMatch[1]}`, {
      headers: { "User-Agent": APPLE_MUSIC_USER_AGENT },
    });
    const jsText = await jsRes.text();
    const tokenMatch = jsText.match(/eyJh[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    if (tokenMatch) return tokenMatch[0];
  }

  throw new Error("Could not retrieve Apple Music API token");
}

/**
 * Fetch playlist data from Apple Music's internal API.
 */
export async function fetchAppleMusicPlaylist(
  storefront: string,
  playlistId: string
): Promise<AppleMusicPlaylist> {
  // Validate storefront (2-letter country code, case-insensitive) and playlistId (pl.xxx format)
  if (!/^[a-zA-Z]{2}$/.test(storefront)) {
    throw new Error("Invalid storefront");
  }
  if (!/^pl\.[a-zA-Z0-9]+$/.test(playlistId)) {
    throw new Error("Invalid playlist ID");
  }

  const token = await fetchAppleMusicToken();

  const apiUrl = `https://amp-api.music.apple.com/v1/catalog/${encodeURIComponent(storefront)}/playlists/${encodeURIComponent(playlistId)}?include=tracks&fields[tracks]=name,artistName,albumName`;

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": APPLE_MUSIC_USER_AGENT,
      Origin: "https://music.apple.com",
    },
  });

  if (!res.ok) {
    throw new Error(`Apple Music API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const playlist = data.data?.[0];
  if (!playlist) throw new Error("Playlist not found");

  const playlistName = playlist.attributes?.name || "Unknown Playlist";
  const curator = playlist.attributes?.curatorName || "";

  // Collect all tracks, handling pagination
  let tracks: AppleMusicTrack[] = [];
  const tracksData = playlist.relationships?.tracks?.data;

  if (tracksData) {
    tracks = tracksData.map(
      (t: { attributes?: { name?: string; artistName?: string; albumName?: string } }) => ({
        name: t.attributes?.name || "Unknown",
        artist: t.attributes?.artistName || "Unknown",
        album: t.attributes?.albumName || "",
      })
    );
  }

  // Handle pagination for large playlists
  let nextUrl = playlist.relationships?.tracks?.next;
  while (nextUrl) {
    const nextRes = await fetch(
      `https://amp-api.music.apple.com${nextUrl}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": APPLE_MUSIC_USER_AGENT,
          Origin: "https://music.apple.com",
        },
      }
    );
    if (!nextRes.ok) break;
    const nextData = await nextRes.json();
    if (nextData.data) {
      tracks = tracks.concat(
        nextData.data.map(
          (t: { attributes?: { name?: string; artistName?: string; albumName?: string } }) => ({
            name: t.attributes?.name || "Unknown",
            artist: t.attributes?.artistName || "Unknown",
            album: t.attributes?.albumName || "",
          })
        )
      );
    }
    nextUrl = nextData.next;
  }

  return { name: playlistName, curator, tracks };
}

/**
 * Fallback: parse Apple Music playlist from the HTML page directly
 * using structured data (JSON-LD) embedded in the page.
 */
export async function fetchAppleMusicPlaylistFromHtml(
  url: string
): Promise<AppleMusicPlaylist> {
  // Validate that the URL is a legitimate Apple Music URL
  const parsedUrl = new URL(url);
  if (
    parsedUrl.hostname !== "music.apple.com" &&
    !parsedUrl.hostname.endsWith(".music.apple.com")
  ) {
    throw new Error("Invalid Apple Music URL");
  }

  const { load } = await import("cheerio");

  const res = await fetch(url, {
    headers: {
      "User-Agent": APPLE_MUSIC_USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();
  const $ = load(html);

  // Try to find JSON-LD structured data
  const jsonLdScripts = $('script[type="application/ld+json"]');
  let playlistName = "Apple Music Playlist";
  const tracks: AppleMusicTrack[] = [];

  jsonLdScripts.each((_i, el) => {
    try {
      const data = JSON.parse($(el).text());
      if (data["@type"] === "MusicPlaylist" || data.name) {
        playlistName = data.name || playlistName;
        if (data.track) {
          for (const track of data.track) {
            tracks.push({
              name: track.name || "Unknown",
              artist: track.byArtist?.name || "Unknown",
              album: track.inAlbum?.name || "",
            });
          }
        }
      }
    } catch {
      // skip malformed JSON-LD
    }
  });

  // If JSON-LD didn't work, try meta tags
  if (tracks.length === 0) {
    const title = $('meta[property="og:title"]').attr("content");
    if (title) playlistName = title;

    // Try to extract from serialized server data
    $("script").each((_i, el) => {
      const text = $(el).text();
      if (text.includes('"relationships"') && text.includes('"tracks"')) {
        try {
          const match = text.match(/\{[\s\S]*"relationships"[\s\S]*\}/);
          if (match) {
            const data = JSON.parse(match[0]);
            const tracksData =
              data.relationships?.tracks?.data ||
              data.d?.[0]?.relationships?.tracks?.data;
            if (tracksData) {
              for (const t of tracksData) {
                tracks.push({
                  name: t.attributes?.name || "Unknown",
                  artist: t.attributes?.artistName || "Unknown",
                  album: t.attributes?.albumName || "",
                });
              }
            }
          }
        } catch {
          // skip
        }
      }
    });
  }

  return { name: playlistName, curator: "", tracks };
}
