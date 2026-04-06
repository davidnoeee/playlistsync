export type SyncStatus =
  | "pending"
  | "searching"
  | "found"
  | "not_found"
  | "synced"
  | "removed"
  | "error";

export interface TrackSyncItem {
  name: string;
  artist: string;
  album: string;
  status: SyncStatus;
  spotifyUri?: string;
  spotifyTrackName?: string;
}

export type AppStep =
  | "input"       // Enter Apple Music URL
  | "loading"     // Loading playlist from Apple Music
  | "preview"     // Preview tracks from Apple Music
  | "auth"        // Sign in with Spotify
  | "choose"      // Choose: new playlist or existing
  | "syncing"     // Syncing tracks
  | "done";       // Done

export interface SpotifySessionData {
  accessToken: string;
  userId: string;
  displayName: string;
}
