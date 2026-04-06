import { NextRequest, NextResponse } from "next/server";
import {
  parseAppleMusicUrl,
  fetchAppleMusicPlaylist,
  fetchAppleMusicPlaylistFromHtml,
} from "@/lib/apple-music";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid Apple Music playlist URL" },
        { status: 400 }
      );
    }

    const parsed = parseAppleMusicUrl(url);

    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid Apple Music playlist URL" },
        { status: 400 }
      );
    }

    try {
      // Primary method: use Apple's internal API
      const playlist = await fetchAppleMusicPlaylist(
        parsed.storefront,
        parsed.playlistId
      );
      return NextResponse.json(playlist);
    } catch {
      // Fallback: parse the HTML page directly
      try {
        const playlist = await fetchAppleMusicPlaylistFromHtml(url);
        if (playlist.tracks.length === 0) {
          return NextResponse.json(
            { error: "Could not extract tracks from this playlist. Make sure it is a public playlist." },
            { status: 400 }
          );
        }
        return NextResponse.json(playlist);
      } catch {
        return NextResponse.json(
          { error: "Failed to fetch playlist. Please check the URL and try again." },
          { status: 500 }
        );
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
