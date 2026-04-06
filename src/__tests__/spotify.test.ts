import {
  getSpotifyAuthUrl,
  getRedirectUri,
} from "@/lib/spotify";

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    SPOTIFY_CLIENT_ID: "test_client_id",
    SPOTIFY_CLIENT_SECRET: "test_client_secret",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("getRedirectUri", () => {
  it("returns the correct redirect URI from env", () => {
    expect(getRedirectUri()).toBe(
      "http://localhost:3000/api/spotify/callback"
    );
  });

  it("falls back to localhost when no env var", () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    expect(getRedirectUri()).toBe(
      "http://localhost:3000/api/spotify/callback"
    );
  });
});

describe("getSpotifyAuthUrl", () => {
  it("generates a valid authorization URL", () => {
    const url = getSpotifyAuthUrl("test_state_123");
    expect(url).toContain("https://accounts.spotify.com/authorize");
    expect(url).toContain("client_id=test_client_id");
    expect(url).toContain("response_type=code");
    expect(url).toContain("state=test_state_123");
    expect(url).toContain("playlist-modify-public");
    expect(url).toContain("playlist-modify-private");
    expect(url).toContain("show_dialog=true");
  });

  it("includes the correct redirect URI", () => {
    const url = getSpotifyAuthUrl("state");
    expect(url).toContain(
      encodeURIComponent("http://localhost:3000/api/spotify/callback")
    );
  });
});
