import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  index,
  date,
  customType,
} from "drizzle-orm/pg-core";
const stamp = (n: string) => timestamp(n, { withTimezone: true });
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});
export const tracks = pgTable(
  "tracks",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    artist: text().notNull(),
    genre: text().notNull().default("Other"),
    description: text().notNull().default(""),
    audio: text("audio_object_key").notNull(),
    cover: text("cover_object_key"),
    mime: text("audio_mime_type").notNull(),
    bytes: integer("audio_size_bytes").notNull(),
    duration: integer("duration_seconds").notNull(),
    downloads: integer("download_count").notNull().default(0),
    featured: boolean("is_featured").notNull().default(false),
    published: boolean("is_published").notNull().default(false),
    release: date("release_date"),
    created: stamp("created_at").notNull().defaultNow(),
    updated: stamp("updated_at").notNull().defaultNow(),
    publishedAt: stamp("published_at"),
  },
  (t) => [
    index("track_rank").on(t.published, t.downloads, t.created),
    index("track_recent").on(t.published, t.created),
    index("track_title").on(t.title),
    index("track_artist").on(t.artist),
    index("track_genre").on(t.genre),
    index("track_downloads").on(t.downloads),
  ],
);
export const events = pgTable(
  "download_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    track: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    time: stamp("downloaded_at").notNull().defaultNow(),
  },
  (t) => [
    index("download_history").on(t.track, t.time),
    index("event_date").on(t.time),
  ],
);
export const media = pgTable("media_objects", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  size: integer("size_bytes").notNull(),
  data: bytea("data").notNull(),
  created: stamp("created_at").notNull().defaultNow(),
});
export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: text().notNull().default("none"),
  createdAt: stamp("createdAt").notNull().defaultNow(),
  updatedAt: stamp("updatedAt").notNull().defaultNow(),
});
export const session = pgTable("session", {
  id: text().primaryKey(),
  token: text().notNull().unique(),
  expiresAt: stamp("expiresAt").notNull(),
  createdAt: stamp("createdAt").notNull().defaultNow(),
  updatedAt: stamp("updatedAt").notNull().defaultNow(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
export const account = pgTable("account", {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: stamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: stamp("refreshTokenExpiresAt"),
  scope: text(),
  password: text(),
  createdAt: stamp("createdAt").notNull().defaultNow(),
  updatedAt: stamp("updatedAt").notNull().defaultNow(),
});
export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: stamp("expiresAt").notNull(),
  createdAt: stamp("createdAt").notNull().defaultNow(),
  updatedAt: stamp("updatedAt").notNull().defaultNow(),
});
