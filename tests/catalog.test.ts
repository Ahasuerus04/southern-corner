import { test, expect } from "bun:test";
import { samples, sampleAudio } from "../lib/demo";
import { rank, isAdmin } from "../lib/types";
import {
  metadataSchema,
  fits,
  audioLimit,
  slug,
  looksLikeMp3,
  musicPatchSchema,
  loginSchema,
} from "../lib/validation";
import { allow, sameOrigin } from "../lib/limits";
import { isManagedKey, musicObjectKey } from "../lib/storage-keys";
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
test("storage keys stay inside managed prefixes", () => {
  expect(isManagedKey(musicObjectKey())).toBe(true);
  expect(isManagedKey("artwork/cover.webp")).toBe(true);
  expect(isManagedKey("other/private.mp3")).toBe(false);
  expect(isManagedKey("music/../secret.mp3")).toBe(false);
  expect(isManagedKey("music\\secret.mp3")).toBe(false);
  expect(isManagedKey("")).toBe(false);
});
test("MP3 validation checks signatures rather than extensions", () => {
  expect(looksLikeMp3(new Uint8Array([0x49, 0x44, 0x33, 0x04]))).toBe(true);
  expect(looksLikeMp3(new Uint8Array([0xff, 0xfb, 0x90, 0x64]))).toBe(true);
  expect(looksLikeMp3(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe(false);
  expect(looksLikeMp3(new Uint8Array([0x00]))).toBe(false);
});
test("metadata patch maps category and validates login", () => {
  expect(musicPatchSchema.parse({ category: "House" })).toEqual({
    genre: "House",
  });
  expect(musicPatchSchema.parse({ published: "on" })).toEqual({
    published: true,
  });
  expect(loginSchema.safeParse({ identifier: "admin", password: "x" }).success).toBe(
    true,
  );
  expect(loginSchema.safeParse({ password: "x" }).success).toBe(false);
});
