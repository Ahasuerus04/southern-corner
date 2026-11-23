import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { parseBuffer } from "music-metadata";
import sharp from "sharp";
import { db } from "./catalog";
import { tracks } from "./schema";
import { upload, remove, storageConfigured } from "./storage";
import { artworkObjectKey, musicObjectKey } from "./storage-keys";
import {
  audioLimit,
  coverLimit,
  fits,
  looksLikeMp3,
  musicMetadataSchema,
  slug,
} from "./validation";

export class MusicError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type StagedAudio = {
  key: string;
  buffer: Buffer;
  bytes: number;
  duration: number;
};

type StagedArtwork = {
  key: string;
  buffer: Buffer;
};

async function cleanup(keys: (string | null | undefined)[]) {
  await Promise.all(
    keys
      .filter((key): key is string => Boolean(key))
      .map((key) =>
        remove(key).catch(() =>
          console.warn("Pending object-storage cleanup:", key),
        ),
      ),
  );
}

function requireStorage() {
  if (!storageConfigured)
    throw new MusicError(
      503,
      "Object storage is not configured. Set the Neon Object Storage environment variables.",
    );
}

async function stageAudio(file: File): Promise<StagedAudio> {
  if (!fits(file.size, audioLimit))
    throw new MusicError(
      400,
      `Choose an MP3 smaller than ${Math.round(audioLimit / 1048576)} MiB.`,
    );
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeMp3(buffer))
    throw new MusicError(400, "Choose a valid MP3 recording.");
  const meta = await parseBuffer(buffer, undefined, { duration: true }).catch(
    () => null,
  );
  if (
    !meta?.format.codec?.includes("Layer 3") ||
    !meta.format.duration ||
    !Number.isFinite(meta.format.duration)
  )
    throw new MusicError(400, "Choose a valid MP3 recording.");
  return {
    key: musicObjectKey(),
    buffer,
    bytes: buffer.length,
    duration: Math.round(meta.format.duration),
  };
}

async function stageArtwork(file: File): Promise<StagedArtwork> {
  if (!fits(file.size, coverLimit))
    throw new MusicError(
      400,
      `Artwork must be smaller than ${Math.round(coverLimit / 1048576)} MiB.`,
    );
  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input, { limitInputPixels: 24e6 });
  const info = await image.metadata().catch(() => null);
  if (!info || !["jpeg", "png", "webp"].includes(info.format || ""))
    throw new MusicError(400, "Choose a JPEG, PNG or WebP artwork file.");
  return {
    key: artworkObjectKey(),
    buffer: await image
      .rotate()
      .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
      .webp()
      .toBuffer(),
  };
}

function readMetadata(form: FormData) {
  const parsed = musicMetadataSchema.safeParse(
    Object.fromEntries(
      [
        "title",
        "artist",
        "category",
        "genre",
        "description",
        "release",
        "published",
        "featured",
      ].map((key) => [key, form.get(key) || ""]),
    ),
  );
  if (!parsed.success)
    throw new MusicError(
      400,
      "Check the title, artist, category, release date and text lengths.",
    );
  return parsed.data;
}

function fileFrom(form: FormData, name: string) {
  const value = form.get(name);
  return value instanceof File && value.size > 0 ? value : undefined;
}

export async function createMusic(form: FormData) {
  requireStorage();
  const data = readMetadata(form);
  const audioFile = fileFrom(form, "audio");
  if (!audioFile) throw new MusicError(400, "An MP3 recording is required.");
  const artworkFile = fileFrom(form, "artwork") ?? fileFrom(form, "cover");
  const staged: string[] = [];
  try {
    const audio = await stageAudio(audioFile);
    await upload(audio.key, audio.buffer, "audio/mpeg");
    staged.push(audio.key);
    let cover: string | null = null;
    if (artworkFile) {
      const artwork = await stageArtwork(artworkFile);
      await upload(artwork.key, artwork.buffer, "image/webp");
      staged.push(artwork.key);
      cover = artwork.key;
    }
    const [created] = await db
      .insert(tracks)
      .values({
        slug: slug(data.title),
        title: data.title,
        artist: data.artist,
        genre: data.genre,
        description: data.description,
        release: data.release,
        published: data.published,
        featured: data.featured,
        publishedAt: data.published ? new Date() : null,
        audio: audio.key,
        cover,
        bytes: audio.bytes,
        duration: audio.duration,
        mime: "audio/mpeg",
      })
      .returning({ id: tracks.id });
    if (!created) throw new Error("Track insert returned no row");
    return { id: created.id };
  } catch (error) {
    await cleanup(staged);
    throw error;
  }
}

export async function updateMusic(id: string, form: FormData) {
  requireStorage();
  const data = readMetadata(form);
  const [old] = await db.select().from(tracks).where(eq(tracks.id, id));
  if (!old) throw new MusicError(404, "Track not found.");
  const audioFile = fileFrom(form, "audio");
  const artworkFile = fileFrom(form, "artwork") ?? fileFrom(form, "cover");
  const staged: string[] = [];
  try {
    let audio = old.audio;
    let bytes = old.bytes;
    let duration = old.duration;
    if (audioFile) {
      const next = await stageAudio(audioFile);
      await upload(next.key, next.buffer, "audio/mpeg");
      staged.push(next.key);
      audio = next.key;
      bytes = next.bytes;
      duration = next.duration;
    }
    let cover = old.cover;
    if (artworkFile) {
      const next = await stageArtwork(artworkFile);
      await upload(next.key, next.buffer, "image/webp");
      staged.push(next.key);
      cover = next.key;
    }
    const [updated] = await db
      .update(tracks)
      .set({
        title: data.title,
        artist: data.artist,
        genre: data.genre,
        description: data.description,
        release: data.release,
        published: data.published,
        featured: data.featured,
        publishedAt: data.published
          ? old.publishedAt || new Date()
          : null,
        audio,
        cover,
        bytes,
        duration,
        mime: "audio/mpeg",
        updated: new Date(),
      })
      .where(
        and(
          eq(tracks.id, id),
          eq(tracks.audio, old.audio),
          old.cover ? eq(tracks.cover, old.cover) : isNull(tracks.cover),
        ),
      )
      .returning({ id: tracks.id });
    if (!updated) throw new MusicError(409, "Track changed concurrently.");
    await cleanup([
      old.audio !== audio ? old.audio : null,
      old.cover !== cover ? old.cover : null,
    ]);
    return { id };
  } catch (error) {
    await cleanup(staged);
    throw error;
  }
}

export async function patchMusic(
  id: string,
  patch: {
    title?: string;
    artist?: string;
    genre?: string;
    description?: string;
    release?: string | null;
    published?: boolean;
    featured?: boolean;
  },
) {
  const [old] = await db.select().from(tracks).where(eq(tracks.id, id));
  if (!old) throw new MusicError(404, "Track not found.");
  if (!Object.keys(patch).length)
    throw new MusicError(400, "No changes were provided.");
  const [updated] = await db
    .update(tracks)
    .set({
      ...patch,
      ...(patch.published !== undefined
        ? {
            publishedAt: patch.published
              ? old.publishedAt || new Date()
              : null,
          }
        : {}),
      updated: new Date(),
    })
    .where(eq(tracks.id, id))
    .returning({ id: tracks.id });
  if (!updated) throw new MusicError(404, "Track not found.");
  return { id };
}

export async function togglePublished(id: string) {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, id));
  if (!track) throw new MusicError(404, "Track not found.");
  return patchMusic(id, { published: !track.published });
}

export async function deleteMusic(id: string) {
  const [old] = await db.select().from(tracks).where(eq(tracks.id, id));
  if (!old) throw new MusicError(404, "Track not found.");
  // The database is the source of truth. Remove the record first so a storage
  // outage cannot leave a public, orphaned row. Any failed object deletion is
  // logged for operator reconciliation.
  const [deleted] = await db
    .delete(tracks)
    .where(eq(tracks.id, id))
    .returning({ id: tracks.id, audio: tracks.audio, cover: tracks.cover });
  if (!deleted) throw new MusicError(404, "Track not found.");
  await cleanup([deleted.audio, deleted.cover]);
  return { id: deleted.id };
}
