import { NextResponse } from "next/server";
import { getSpotifyAuthUrl } from "@/lib/spotify";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const url = getSpotifyAuthUrl(state);

  const response = NextResponse.json({ url, state });
  return response;
}
