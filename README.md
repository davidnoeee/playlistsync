# PlaylistSync

Sync Apple Music playlists to Spotify. Paste a public Apple Music playlist link, sign in with Spotify, and create or sync a playlist in your Spotify account.

## Features

- **Parse Apple Music playlists** — Fetches track data from any public Apple Music playlist URL via server-side API calls (no CORS issues)
- **Spotify OAuth** — Securely sign in with your Spotify account
- **Create new playlists** — Automatically creates a new Spotify playlist with matched tracks
- **Sync existing playlists** — Select an existing Spotify playlist to sync; adds missing tracks and removes extras
- **Track matching** — Searches Spotify for each Apple Music track by name and artist with intelligent fallback
- **Real-time status** — Shows sync progress with per-track status indicators

## Getting Started

### Prerequisites

- Node.js 18+
- A [Spotify Developer](https://developer.spotify.com/dashboard) application

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in your Spotify credentials:
   ```bash
   cp .env.example .env.local
   ```
4. In your Spotify Developer Dashboard, add `http://localhost:3000/api/spotify/callback` as a Redirect URI
5. Start the dev server:
   ```bash
   npm run dev
   ```

### Environment Variables

| Variable | Description |
|---|---|
| `SPOTIFY_CLIENT_ID` | Your Spotify app's Client ID |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify app's Client Secret |
| `NEXT_PUBLIC_BASE_URL` | Base URL of your app (e.g., `http://localhost:3000`) |

## Architecture

- **Next.js 16 App Router** with TypeScript
- **Tailwind CSS v4** for styling
- **Server-side API routes** to proxy Apple Music and Spotify API calls (avoids CORS)
- **Apple Music parsing**: Extracts a bearer token from Apple Music's web app, then calls their internal catalog API to fetch playlist tracks. Falls back to HTML scraping with Cheerio if the API approach fails.
- **Spotify integration**: Authorization Code flow via API routes for secure token exchange

## Testing

```bash
npm test
```

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Cheerio (HTML parsing fallback)
- Jest (testing)