import { z } from "zod";
export const metadataSchema = z.object({
  title: z.string().trim().min(1).max(180),
  artist: z.string().trim().min(1).max(150),
  genre: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || "Other"),
  description: z.string().trim().max(4000),
  release: z.union([z.iso.date(), z.literal("")]).transform((v) => v || null),
  published: z.enum(["on", ""]).transform((v) => !!v),
  featured: z.enum(["on", ""]).transform((v) => !!v),
});
export const audioLimit = 32 * 1024 * 1024,
  coverLimit = 5 * 1024 * 1024;
export function fits(size: number, cap: number) {
  return Number.isInteger(size) && size > 0 && size <= cap;
}
export function slug(title: string) {
  return `${
    title
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "track"
  }-${crypto.randomUUID().slice(0, 8)}`;
}
