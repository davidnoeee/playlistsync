export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  images: { url: string }[];
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  tracks: { total: number };
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
}

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

export function getSpotifyClientId(): string {
  return process.env.SPOTIFY_CLIENT_ID || "";
}

export function getSpotifyClientSecret(): string {
  return process.env.SPOTIFY_CLIENT_SECRET || "";
}

export function getRedirectUri(): string {
  return process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify/callback`
    : "http://localhost:3000/api/spotify/callback";
}

/**
 * Generate the Spotify authorization URL for the user to sign in.
 */
export function getSpotifyAuthUrl(state: string): string {
  const scopes = [
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-public",
    "playlist-modify-private",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: getSpotifyClientId(),
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: scopes,
    state,
    show_dialog: "true",
  });

  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<SpotifyTokens> {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${getSpotifyClientId()}:${getSpotifyClientSecret()}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token exchange failed: ${err}`);
  }

  return res.json();
}

/**
 * Get the current user's Spotify profile.
 */
export async function getSpotifyUser(
  accessToken: string
): Promise<SpotifyUser> {
  const res = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to get Spotify user");
  return res.json();
}

/**
 * Get the current user's playlists.
 */
export async function getUserPlaylists(
  accessToken: string
): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let url: string | null = `${SPOTIFY_API_BASE}/me/playlists?limit=50`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Failed to get playlists");
    const data = await res.json();
    playlists.push(...data.items);
    url = data.next;
    // Validate pagination URL is from Spotify API
    if (url && !url.startsWith(SPOTIFY_API_BASE)) {
      break;
    }
  }

  return playlists;
}

/**
 * Sanitize a search term for Spotify's query syntax.
 * Removes colons, quotes, and backslashes to prevent query injection.
 * Note: This means legitimate colons in names are stripped, but the
 * track:/artist: field operators in the query use their own colons.
 */
function sanitizeSearchTerm(term: string): string {
  // Remove Spotify query field operators and special chars
  return term.replace(/[:"\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Search for a track on Spotify. Returns the best match or null.
 */
export async function searchTrack(
  accessToken: string,
  trackName: string,
  artistName: string
): Promise<SpotifyTrack | null> {
  const safeName = sanitizeSearchTerm(trackName);
  const safeArtist = sanitizeSearchTerm(artistName);

  // Try exact search first
  const query = `track:${safeName} artist:${safeArtist}`;
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "5",
  });

  const res = await fetch(`${SPOTIFY_API_BASE}/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const tracks = data.tracks?.items;

  if (tracks && tracks.length > 0) {
    return tracks[0];
  }

  // Fallback: broader search
  const fallbackParams = new URLSearchParams({
    q: `${safeName} ${safeArtist}`,
    type: "track",
    limit: "5",
  });

  const fallbackRes = await fetch(
    `${SPOTIFY_API_BASE}/search?${fallbackParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!fallbackRes.ok) return null;

  const fallbackData = await fallbackRes.json();
  const fallbackTracks = fallbackData.tracks?.items;

  return fallbackTracks?.[0] || null;
}

/**
 * Validate that a Spotify ID contains only allowed characters.
 */
function validateSpotifyId(id: string): string {
  if (!/^[a-zA-Z0-9]+$/.test(id)) {
    throw new Error("Invalid Spotify ID");
  }
  return id;
}

/**
 * Create a new Spotify playlist.
 */
export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description: string
): Promise<SpotifyPlaylist> {
  const safeUserId = validateSpotifyId(userId);
  const res = await fetch(`${SPOTIFY_API_BASE}/users/${safeUserId}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description,
      public: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create playlist: ${err}`);
  }

  return res.json();
}

/**
 * Get all tracks from a Spotify playlist.
 */
export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<SpotifyTrack[]> {
  const safeId = validateSpotifyId(playlistId);
  const tracks: SpotifyTrack[] = [];
  let url: string | null = `${SPOTIFY_API_BASE}/playlists/${safeId}/tracks?limit=100`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Failed to get playlist tracks");
    const data = await res.json();
    for (const item of data.items) {
      if (item.track) tracks.push(item.track);
    }
    url = data.next;
    // Validate pagination URL is from Spotify API
    if (url && !url.startsWith(SPOTIFY_API_BASE)) {
      break;
    }
  }

  return tracks;
}

/**
 * Add tracks to a playlist (max 100 per request).
 */
export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  const safeId = validateSpotifyId(playlistId);
  // Spotify allows max 100 tracks per request
  for (let i = 0; i < trackUris.length; i += 100) {
    const batch = trackUris.slice(i, i + 100);
    const res = await fetch(
      `${SPOTIFY_API_BASE}/playlists/${safeId}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: batch }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to add tracks: ${err}`);
    }
  }
}

/**
 * Remove tracks from a playlist.
 */
export async function removeTracksFromPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  const safeId = validateSpotifyId(playlistId);
  for (let i = 0; i < trackUris.length; i += 100) {
    const batch = trackUris.slice(i, i + 100);
    const res = await fetch(
      `${SPOTIFY_API_BASE}/playlists/${safeId}/tracks`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tracks: batch.map((uri) => ({ uri })),
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to remove tracks: ${err}`);
    }
  }
}
