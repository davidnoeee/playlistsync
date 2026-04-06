import { NextRequest, NextResponse } from "next/server";
import { getUserPlaylists } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("x-spotify-token");

  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing access token" },
      { status: 401 }
    );
  }

  try {
    const playlists = await getUserPlaylists(accessToken);
    return NextResponse.json({ playlists });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch playlists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
