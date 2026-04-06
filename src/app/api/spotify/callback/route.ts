import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getSpotifyUser } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?error=no_code", request.url)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const user = await getSpotifyUser(tokens.access_token);

    // Redirect back to the app with the token data as a query parameter
    const params = new URLSearchParams({
      access_token: tokens.access_token,
      user_id: user.id,
      display_name: user.display_name || user.id,
    });

    return NextResponse.redirect(
      new URL(`/?spotify_auth=${encodeURIComponent(params.toString())}`, request.url)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
