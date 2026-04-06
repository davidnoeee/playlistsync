import type { TrackSyncItem, AppStep } from "@/lib/types";

describe("Types", () => {
  it("TrackSyncItem has correct structure", () => {
    const item: TrackSyncItem = {
      name: "Test Song",
      artist: "Test Artist",
      album: "Test Album",
      status: "synced",
      spotifyUri: "spotify:track:123",
      spotifyTrackName: "Test Song – Test Artist",
    };

    expect(item.name).toBe("Test Song");
    expect(item.status).toBe("synced");
    expect(item.spotifyUri).toBe("spotify:track:123");
  });

  it("AppStep covers all expected steps", () => {
    const steps: AppStep[] = [
      "input",
      "loading",
      "preview",
      "auth",
      "choose",
      "syncing",
      "done",
    ];

    expect(steps).toHaveLength(7);
  });

  it("TrackSyncItem status types are valid", () => {
    const statuses: TrackSyncItem["status"][] = [
      "pending",
      "searching",
      "found",
      "not_found",
      "synced",
      "removed",
      "error",
    ];

    expect(statuses).toHaveLength(7);
  });
});
