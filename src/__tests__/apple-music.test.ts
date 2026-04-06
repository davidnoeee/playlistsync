import { parseAppleMusicUrl } from "@/lib/apple-music";

describe("parseAppleMusicUrl", () => {
  it("parses a standard playlist URL", () => {
    const result = parseAppleMusicUrl(
      "https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb"
    );
    expect(result).toEqual({
      storefront: "us",
      playlistId: "pl.f4d106fed2bd41149aaacabb233eb5eb",
    });
  });

  it("parses a URL with a different storefront", () => {
    const result = parseAppleMusicUrl(
      "https://music.apple.com/gb/playlist/some-playlist/pl.abc123def456"
    );
    expect(result).toEqual({
      storefront: "gb",
      playlistId: "pl.abc123def456",
    });
  });

  it("parses a URL without a playlist name segment", () => {
    const result = parseAppleMusicUrl(
      "https://music.apple.com/de/playlist/pl.xyz789"
    );
    expect(result).toEqual({
      storefront: "de",
      playlistId: "pl.xyz789",
    });
  });

  it("returns null for non-Apple Music URLs", () => {
    expect(parseAppleMusicUrl("https://open.spotify.com/playlist/abc")).toBeNull();
    expect(parseAppleMusicUrl("https://google.com")).toBeNull();
  });

  it("returns null for Apple Music URLs without a playlist", () => {
    expect(
      parseAppleMusicUrl("https://music.apple.com/us/album/some-album/123")
    ).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(parseAppleMusicUrl("not-a-url")).toBeNull();
    expect(parseAppleMusicUrl("")).toBeNull();
  });

  it("returns null for Apple Music playlist URL without pl. prefix", () => {
    expect(
      parseAppleMusicUrl(
        "https://music.apple.com/us/playlist/my-playlist/12345"
      )
    ).toBeNull();
  });
});
