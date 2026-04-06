import { NextRequest, NextResponse } from "next/server";
import {
  searchTrack,
  createPlaylist,
  getPlaylistTracks,
  addTracksToPlaylist,
  removeTracksFromPlaylist,
  getSpotifyUser,
} from "@/lib/spotify";
import type { AppleMusicTrack } from "@/lib/apple-music";

interface SyncRequest {
  tracks: AppleMusicTrack[];
  playlistName: string;
  existingPlaylistId?: string;
}

interface TrackResult {
  name: string;
  artist: string;
  status: "found" | "not_found";
  spotifyUri?: string;
  spotifyTrackName?: string;
}

export async function POST(request: NextRequest) {
  const accessToken = request.headers.get("x-spotify-token");

  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing access token" },
      { status: 401 }
    );
  }

  try {
    const body: SyncRequest = await request.json();
    const { tracks, playlistName, existingPlaylistId } = body;

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { error: "No tracks provided" },
        { status: 400 }
      );
    }

    // Search for all tracks on Spotify
    const results: TrackResult[] = [];
    for (const track of tracks) {
      const found = await searchTrack(accessToken, track.name, track.artist);
      if (found) {
        results.push({
          name: track.name,
          artist: track.artist,
          status: "found",
          spotifyUri: found.uri,
          spotifyTrackName: `${found.name} – ${found.artists.map((a) => a.name).join(", ")}`,
        });
      } else {
        results.push({
          name: track.name,
          artist: track.artist,
          status: "not_found",
        });
      }
    }

    const foundUris = results
      .filter((r) => r.status === "found" && r.spotifyUri)
      .map((r) => r.spotifyUri!);

    let playlistId: string;
    let playlistUrl: string;

    if (existingPlaylistId) {
      // Sync with existing playlist
      playlistId = existingPlaylistId;
      const existingTracks = await getPlaylistTracks(accessToken, playlistId);
      const existingUris = new Set(existingTracks.map((t) => t.uri));
      const newUris = new Set(foundUris);

      // Add tracks that are in Apple Music but not in Spotify playlist
      const toAdd = foundUris.filter((uri) => !existingUris.has(uri));
      if (toAdd.length > 0) {
        await addTracksToPlaylist(accessToken, playlistId, toAdd);
      }

      // Remove tracks that are in Spotify playlist but not in Apple Music
      const toRemove = existingTracks
        .map((t) => t.uri)
        .filter((uri) => !newUris.has(uri));
      if (toRemove.length > 0) {
        await removeTracksFromPlaylist(accessToken, playlistId, toRemove);
      }

      playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
    } else {
      // Create new playlist
      const user = await getSpotifyUser(accessToken);
      const newPlaylist = await createPlaylist(
        accessToken,
        user.id,
        playlistName,
        `Synced from Apple Music by PlaylistSync`
      );
      playlistId = newPlaylist.id;

      if (foundUris.length > 0) {
        await addTracksToPlaylist(accessToken, playlistId, foundUris);
      }

      playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
    }

    return NextResponse.json({
      results,
      playlistId,
      playlistUrl,
      stats: {
        total: tracks.length,
        found: results.filter((r) => r.status === "found").length,
        notFound: results.filter((r) => r.status === "not_found").length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
