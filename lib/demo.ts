import type { Track } from "./types";
export const demo =
  process.env.NODE_ENV === "development" && !process.env.DATABASE_URL;
const entries = [
  ["After Hours", "Northbound", "Ambient"],
  ["Solar Motion", "Forma", "Electronic"],
  ["Violet Skies", "Luna Vale", "Lo-fi"],
  ["Blue Structure", "Parallel Lines", "House"],
];
export const samples: Track[] = entries.map(([title, artist, genre], i) => ({
  id: `demo-${i + 1}`,
  slug: title.toLowerCase().replaceAll(" ", "-"),
  title,
  artist,
  genre,
  description: `An original ${genre.toLowerCase()} synthesizer study from the Sidewave development collection.`,
  cover: `/cover-${i + 1}.webp`,
  duration: 24 + i * 4,
  downloads: 0,
  created: `2026-01-0${4 - i}`,
  featured: true,
  published: true,
}));
export function sampleAudio(index: number) {
  const rate = 16000,
    len = rate * samples[index].duration,
    b = Buffer.alloc(44 + len * 2);
  b.write("RIFF");
  b.writeUInt32LE(36 + len * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(len * 2, 40);
  const root = [164.81, 196, 146.83, 220][index],
    notes = [0, 3, 7, 10, 7, 3, 12, 7];
  for (let i = 0; i < len; i++) {
    const t = i / rate,
      beat = t / (0.34 + index * 0.04),
      phase = beat % 1;
    const f = root * 2 ** (notes[Math.floor(beat) % 8] / 12);
    const chord =
      [0, 3, 7].reduce(
        (v, n) => v + Math.sin(((2 * Math.PI * t * root) / 2) * 2 ** (n / 12)),
        0,
      ) / 3;
    const env = Math.min(1, phase * 25) * Math.exp(-phase * 3),
      fade = Math.min(1, t, (len - i) / rate);
    b.writeInt16LE(
      Math.round(
        (chord * 0.16 + Math.sin(t * f * 2 * Math.PI) * env * 0.32) *
          fade *
          32000,
      ),
      44 + 2 * i,
    );
  }
  return b;
}
