"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AppStep, TrackSyncItem, SpotifySessionData } from "@/lib/types";
import type { AppleMusicTrack } from "@/lib/apple-music";

interface SpotifyPlaylistOption {
  id: string;
  name: string;
  tracks: { total: number };
}

interface SyncResult {
  name: string;
  artist: string;
  status: "found" | "not_found";
  spotifyUri?: string;
  spotifyTrackName?: string;
}

function getInitialAuthState(): {
  session: SpotifySessionData | null;
  error: string;
  step: AppStep;
  tracks: AppleMusicTrack[];
  playlistName: string;
} {
  if (typeof window === "undefined") {
    return { session: null, error: "", step: "input", tracks: [], playlistName: "" };
  }

  const params = new URLSearchParams(window.location.search);
  const authData = params.get("spotify_auth");
  const authError = params.get("error");

  if (authError) {
    return {
      session: null,
      error: `Spotify auth error: ${authError}`,
      step: "input",
      tracks: [],
      playlistName: "",
    };
  }

  if (authData) {
    const authParams = new URLSearchParams(authData);
    const session: SpotifySessionData = {
      accessToken: authParams.get("access_token") || "",
      userId: authParams.get("user_id") || "",
      displayName: authParams.get("display_name") || "",
    };

    // Restore tracks from sessionStorage
    const savedTracks = sessionStorage.getItem("ps_tracks");
    const savedName = sessionStorage.getItem("ps_playlist_name");
    if (savedTracks) {
      return {
        session,
        error: "",
        step: "choose",
        tracks: JSON.parse(savedTracks),
        playlistName: savedName || "Apple Music Playlist",
      };
    }

    return { session, error: "", step: "input", tracks: [], playlistName: "" };
  }

  return { session: null, error: "", step: "input", tracks: [], playlistName: "" };
}

export default function Home() {
  const initRef = useRef(false);
  const [initial] = useState(getInitialAuthState);
  const [step, setStep] = useState<AppStep>(initial.step);
  const [url, setUrl] = useState("");
  const [error, setError] = useState(initial.error);
  const [playlistName, setPlaylistName] = useState(initial.playlistName);
  const [tracks, setTracks] = useState<AppleMusicTrack[]>(initial.tracks);
  const [syncItems, setSyncItems] = useState<TrackSyncItem[]>([]);
  const [spotifySession, setSpotifySession] =
    useState<SpotifySessionData | null>(initial.session);
  const [playlists, setPlaylists] = useState<SpotifyPlaylistOption[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null
  );
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [syncStats, setSyncStats] = useState({ total: 0, found: 0, notFound: 0 });

  // Clean up URL params after OAuth redirect (one-time side effect)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.has("spotify_auth") || params.has("error")) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const fetchPlaylist = useCallback(async () => {
    if (!url.trim()) {
      setError("Please enter an Apple Music playlist URL");
      return;
    }

    setError("");
    setStep("loading");

    try {
      const res = await fetch("/api/apple-music/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch playlist");
        setStep("input");
        return;
      }

      setPlaylistName(data.name);
      setTracks(data.tracks);
      setStep("preview");
    } catch {
      setError("Network error. Please try again.");
      setStep("input");
    }
  }, [url]);

  const handleSpotifyAuth = async () => {
    // Save tracks to sessionStorage before redirecting
    sessionStorage.setItem("ps_tracks", JSON.stringify(tracks));
    sessionStorage.setItem("ps_playlist_name", playlistName);

    try {
      const res = await fetch("/api/spotify/auth");
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setError("Failed to initiate Spotify auth");
    }
  };

  const fetchUserPlaylists = async () => {
    if (!spotifySession) return;
    try {
      const res = await fetch("/api/spotify/playlists", {
        headers: { "x-spotify-token": spotifySession.accessToken },
      });
      const data = await res.json();
      if (data.playlists) {
        setPlaylists(data.playlists);
      }
    } catch {
      setError("Failed to fetch your playlists");
    }
  };

  const startSync = async (existingId?: string) => {
    if (!spotifySession) return;

    setStep("syncing");
    setSyncItems(
      tracks.map((t) => ({
        name: t.name,
        artist: t.artist,
        album: t.album,
        status: "searching",
      }))
    );

    try {
      const res = await fetch("/api/spotify/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-spotify-token": spotifySession.accessToken,
        },
        body: JSON.stringify({
          tracks,
          playlistName,
          existingPlaylistId: existingId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Sync failed");
        setStep("choose");
        return;
      }

      // Update sync items with results
      setSyncItems(
        data.results.map((r: SyncResult) => ({
          name: r.name,
          artist: r.artist,
          album: "",
          status: r.status === "found" ? "synced" : "not_found",
          spotifyUri: r.spotifyUri,
          spotifyTrackName: r.spotifyTrackName,
        }))
      );

      setPlaylistUrl(data.playlistUrl);
      setSyncStats(data.stats);
      setStep("done");
      sessionStorage.removeItem("ps_tracks");
      sessionStorage.removeItem("ps_playlist_name");
    } catch {
      setError("Sync failed. Please try again.");
      setStep("choose");
    }
  };

  const reset = () => {
    setStep("input");
    setUrl("");
    setError("");
    setPlaylistName("");
    setTracks([]);
    setSyncItems([]);
    setSpotifySession(null);
    setPlaylists([]);
    setSelectedPlaylistId(null);
    setPlaylistUrl("");
    setSyncStats({ total: 0, found: 0, notFound: 0 });
    sessionStorage.removeItem("ps_tracks");
    sessionStorage.removeItem("ps_playlist_name");
  };

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold tracking-tight">
            PlaylistSync
          </h1>
          <p className="text-sm font-medium text-white/50 mt-1">
            Apple Music → Spotify
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-full border border-red/30 bg-red-muted text-sm text-red flex items-center gap-2">
            <span className="material-icons-round text-base">error</span>
            {error}
          </div>
        )}

        {/* Step: Input */}
        {step === "input" && (
          <div className="space-y-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPlaylist()}
              placeholder="Paste Apple Music playlist link"
              className="w-full px-5 py-3.5 rounded-full bg-transparent border border-white/20 text-white text-sm font-medium placeholder:text-white/30 outline-none focus:border-white/50 transition-colors"
            />
            <button
              onClick={fetchPlaylist}
              className="w-full px-5 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:bg-white/80 transition-colors"
            >
              Fetch Playlist
            </button>
          </div>
        )}

        {/* Step: Loading */}
        {step === "loading" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-sm font-medium text-white/50">
              Fetching playlist…
            </p>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {playlistName}
              </h2>
              <p className="text-sm font-medium text-white/50 mt-0.5">
                {tracks.length} track{tracks.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
              {tracks.map((track, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                >
                  <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium text-white truncate">
                      {track.name}
                    </p>
                    <p className="text-xs font-medium text-white/40 truncate">
                      {track.artist}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-white/30 px-2.5 py-1 rounded-full border border-white/10">
                    #{i + 1}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleSpotifyAuth}
              className="w-full px-5 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:bg-white/80 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-icons-round text-base">login</span>
              Continue with Spotify
            </button>

            <button
              onClick={() => setStep("input")}
              className="w-full px-5 py-3.5 rounded-full border border-white/20 text-white text-sm font-medium hover:border-white/40 transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {/* Step: Choose playlist */}
        {step === "choose" && spotifySession && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium text-white/40 mb-1">
                Signed in as
              </p>
              <p className="text-sm font-semibold">
                {spotifySession.displayName}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => startSync()}
                className="w-full px-5 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:bg-white/80 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-icons-round text-base">
                  add_circle
                </span>
                Create New Playlist
              </button>

              <button
                onClick={fetchUserPlaylists}
                className="w-full px-5 py-3.5 rounded-full border border-white/20 text-white text-sm font-medium hover:border-white/40 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-icons-round text-base">sync</span>
                Sync with Existing Playlist
              </button>
            </div>

            {playlists.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-white/40">
                  Select a playlist
                </p>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => setSelectedPlaylistId(pl.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-colors flex items-center justify-between ${
                        selectedPlaylistId === pl.id
                          ? "bg-white/10 border border-white/30"
                          : "border border-transparent hover:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0 mr-3">
                        <p className="text-sm font-medium text-white truncate">
                          {pl.name}
                        </p>
                        <p className="text-xs font-medium text-white/40">
                          {pl.tracks.total} tracks
                        </p>
                      </div>
                      {selectedPlaylistId === pl.id && (
                        <span className="material-icons-round text-base text-white/60">
                          check_circle
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedPlaylistId && (
                  <button
                    onClick={() => startSync(selectedPlaylistId)}
                    className="w-full px-5 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:bg-white/80 transition-colors mt-3"
                  >
                    Sync to Selected Playlist
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step: Syncing */}
        {step === "syncing" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-sm font-semibold">Syncing tracks…</p>
            </div>

            <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-1">
              {syncItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                >
                  <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-xs font-medium text-white/40 truncate">
                      {item.artist}
                    </p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-green-muted flex items-center justify-center">
                <span className="material-icons-round text-green text-2xl">
                  check
                </span>
              </div>
              <h2 className="text-lg font-semibold tracking-tight">
                Sync Complete
              </h2>
              <p className="text-sm font-medium text-white/50">
                {syncStats.found} of {syncStats.total} tracks synced
                {syncStats.notFound > 0 && (
                  <span className="text-white/30">
                    {" "}
                    · {syncStats.notFound} not found
                  </span>
                )}
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-1">
              {syncItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                >
                  <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium text-white truncate">
                      {item.spotifyTrackName || item.name}
                    </p>
                    <p className="text-xs font-medium text-white/40 truncate">
                      {item.artist}
                    </p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>

            {playlistUrl && (
              <a
                href={playlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-5 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 active:bg-white/80 transition-colors text-center"
              >
                Open in Spotify
              </a>
            )}

            <button
              onClick={reset}
              className="w-full px-5 py-3.5 rounded-full border border-white/20 text-white text-sm font-medium hover:border-white/40 transition-colors"
            >
              Sync Another Playlist
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: TrackSyncItem["status"] }) {
  switch (status) {
    case "searching":
    case "pending":
      return (
        <span className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-white/40 px-2.5 py-1 rounded-full border border-white/15">
          <span className="w-3 h-3 border border-white/30 border-t-white/60 rounded-full animate-spin" />
          Searching
        </span>
      );
    case "synced":
    case "found":
      return (
        <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-green px-2.5 py-1 rounded-full bg-green-muted">
          <span className="material-icons-round text-sm">check</span>
          Synced
        </span>
      );
    case "not_found":
      return (
        <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-white/30 px-2.5 py-1 rounded-full border border-white/10">
          <span className="material-icons-round text-sm">close</span>
          Not Found
        </span>
      );
    case "error":
      return (
        <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-red px-2.5 py-1 rounded-full bg-red-muted">
          <span className="material-icons-round text-sm">error</span>
          Error
        </span>
      );
    default:
      return null;
  }
}
