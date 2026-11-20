import { test, expect } from "bun:test";
import { samples, sampleAudio } from "../lib/demo";
import { rank, isAdmin } from "../lib/types";
import { metadataSchema, fits, audioLimit, slug } from "../lib/validation";
import { allow, sameOrigin } from "../lib/limits";
test("only explicit admin role qualifies", () => {
  expect(isAdmin(null)).toBe(false);
  expect(isAdmin({ user: { role: "user" } })).toBe(false);
  expect(isAdmin({ user: { role: "admin" } })).toBe(true);
});
test("ranking counts then recency then id", () => {
  const list = samples.map((x, i) => ({ ...x, downloads: i === 3 ? 4 : 2 }));
  expect(list.sort(rank).map((t) => t.id)).toEqual([
    "demo-4",
    "demo-1",
    "demo-2",
    "demo-3",
  ]);
});
test("audio size limits and required metadata", () => {
  expect(fits(0, audioLimit)).toBe(false);
  expect(fits(audioLimit + 1, audioLimit)).toBe(false);
  expect(fits(audioLimit, audioLimit)).toBe(true);
  expect(metadataSchema.safeParse({ title: " " }).success).toBe(false);
  expect(slug("../text / <x>")).toMatch(/^[a-z0-9-]+$/);
});
test("throttle repeats and expire buckets", () => {
  expect(allow("one", 1, 100, 0)).toBe(true);
  expect(allow("one", 1, 100, 1)).toBe(false);
  expect(allow("one", 1, 100, 101)).toBe(true);
});
test("cross-origin writes are rejected", () =>
  expect(
    sameOrigin(
      new Request("https://example.com", {
        headers: { origin: "https://another.example" },
      }),
    ),
  ).toBe(false));
test("playback produces WAV bytes without changing counts", () => {
  const n = samples[0].downloads,
    b = sampleAudio(0);
  expect(b.toString("ascii", 0, 4)).toBe("RIFF");
  expect(b.length).toBe(44 + 16000 * 2 * samples[0].duration);
  expect(samples[0].downloads).toBe(n);
});
