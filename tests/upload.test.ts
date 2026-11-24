import { describe, expect, test } from "bun:test";
import { artworkSourceKey, isManagedKey } from "../lib/storage-keys";
import { musicUploadSchema } from "../lib/validation";

describe("direct upload payload", () => {
  test("accepts keys generated for direct uploads", () => {
    const parsed = musicUploadSchema.safeParse({
      audio: {
        key: "music/1b5af245-4d19-473a-8c0b-bbf136716dab.mp3",
      },
      artwork: {
        key: "artwork/f09bc39f-28f4-4276-bc97-015db79a553c.source",
      },
      metadata: {
        title: "Track",
        artist: "Artist",
        category: "Test",
        published: true,
        featured: false,
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.metadata.genre).toBe("Test");
      expect(parsed.data.metadata.published).toBe(true);
    }
  });

  test("rejects an invalid track id", () => {
    const parsed = musicUploadSchema.safeParse({
      id: "not-a-uuid",
      audio: { key: "music/x.mp3" },
      metadata: { title: "Track", artist: "Artist" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("storage keys", () => {
  test("source artwork stays inside a managed prefix", () => {
    const key = artworkSourceKey();
    expect(key.startsWith("artwork/")).toBe(true);
    expect(key.endsWith(".source")).toBe(true);
    expect(isManagedKey(key)).toBe(true);
  });
});
