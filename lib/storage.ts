import "server-only";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isManagedKey, MANAGED_PREFIXES } from "./storage-keys";

type Target = { client: S3Client; bucket: string };

/**
 * Read the first non-empty environment variable from a list.
 *
 * Prefer the application-specific `S3_*` names over the generic `AWS_*`
 * names. Vercel (and other serverless platforms) can inject its own
 * `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION` values into
 * the function runtime. Those values are not valid for Neon Object Storage,
 * so they must never take precedence over credentials supplied explicitly for
 * this app.
 */
function pick(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function config() {
  return {
    endpoint: pick([
      "S3_ENDPOINT",
      "NEON_STORAGE_ENDPOINT",
      "AWS_ENDPOINT_URL_S3",
    ]),
    region: pick(["S3_REGION", "NEON_STORAGE_REGION", "AWS_REGION"]) ?? "auto",
    bucket: pick(["S3_BUCKET", "NEON_STORAGE_BUCKET"]),
    accessKeyId: pick(["S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"]),
    secretAccessKey: pick(["S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]),
  };
}

/**
 * Which storage settings are present, without exposing any values. Used by
 * the health endpoint so a deployment misconfiguration is obvious instead of
 * looking like a generic 503.
 */
export function storageStatus() {
  const c = config();
  const missing = [
    !c.endpoint && "S3_ENDPOINT (or AWS_ENDPOINT_URL_S3)",
    !c.bucket && "S3_BUCKET (or NEON_STORAGE_BUCKET)",
    !c.accessKeyId && "S3_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID)",
    !c.secretAccessKey && "S3_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY)",
  ].filter((name): name is string => Boolean(name));
  return {
    configured: missing.length === 0,
    missing,
    region: c.region,
  };
}

export const storageConfigured = storageStatus().configured;

/**
 * Verify that the configured credentials can actually reach the bucket.
 * Returns only an error name/status, never credentials or signed URLs.
 */
export async function storageHealth() {
  const status = storageStatus();
  if (!status.configured) return { ...status, reachable: false };
  try {
    const { client, bucket } = target();
    await client.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }),
    );
    return { ...status, reachable: true };
  } catch (error) {
    const e = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    const code = e?.$metadata?.httpStatusCode;
    return {
      ...status,
      reachable: false,
      error: `${e?.name ?? "StorageError"}${code ? ` (${code})` : ""}`,
    };
  }
}

let client: S3Client | undefined;

function target(): Target {
  const c = config();
  if (!c.endpoint || !c.bucket || !c.accessKeyId || !c.secretAccessKey)
    throw new Error("Object storage is not configured");
  client ??= new S3Client({
    endpoint: c.endpoint,
    region: c.region,
    // Neon Object Storage and most S3-compatible services use path-style
    // addressing. Set S3_FORCE_PATH_STYLE=false for virtual-hosted buckets.
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
    },
    // Avoid SDK checksum headers that some S3-compatible providers reject.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket: c.bucket };
}

export async function upload(
  Key: string,
  Body: Uint8Array,
  ContentType: string,
) {
  if (!isManagedKey(Key)) throw new Error("Refusing to write an unmanaged key");
  const { client, bucket } = target();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key,
      Body,
      ContentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

/**
 * Sign a short-lived URL that lets the browser upload one file directly to
 * object storage. The file never passes through the application function, so
 * platform request-body limits do not apply.
 */
export async function uploadUrl(
  Key: string,
  ContentType: string,
  expiresIn = 600,
) {
  if (!isManagedKey(Key)) throw new Error("Refusing to sign an unmanaged key");
  const { client, bucket } = target();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key, ContentType }),
    { expiresIn },
  );
}

/** Metadata for an object the browser has just uploaded. */
export async function objectInfo(Key: string) {
  if (!isManagedKey(Key)) throw new Error("Refusing to read an unmanaged key");
  const { client, bucket } = target();
  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key }),
  );
  return {
    size: head.ContentLength ?? 0,
    contentType: head.ContentType ?? "",
  };
}

/**
 * Read an uploaded object back for server-side validation. Callers must check
 * `objectInfo().size` against the configured limit first.
 */
export async function readObject(Key: string, maxBytes: number) {
  if (!isManagedKey(Key)) throw new Error("Refusing to read an unmanaged key");
  const { client, bucket } = target();
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key }),
  );
  if ((response.ContentLength ?? 0) > maxBytes)
    throw new Error("Object exceeds the allowed size");
  const body = await response.Body?.transformToByteArray();
  if (!body) throw new Error("Object body was empty");
  return Buffer.from(body);
}

export async function remove(Key: string) {
  // Never allow a database value or request parameter to delete objects that
  // belong to another application or an unrelated prefix.
  if (!isManagedKey(Key)) throw new Error("Refusing to delete an unmanaged key");
  const { client, bucket } = target();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
}

export async function exists(Key: string) {
  if (!isManagedKey(Key)) return false;
  const { client, bucket } = target();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key }));
    return true;
  } catch (error) {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404)
      return false;
    throw error;
  }
}

export async function signed(
  Key: string,
  options: {
    filename?: string;
    contentType?: string;
    expiresIn?: number;
    verify?: boolean;
  } = {},
) {
  if (!isManagedKey(Key)) throw new Error("Refusing to sign an unmanaged key");
  const { client, bucket } = target();
  // Verify the object exists before handing a URL to a visitor. Missing
  // objects must not increase download statistics. Callers that just checked
  // existence may skip the extra HEAD request.
  if (options.verify !== false)
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key }));
  const disposition = options.filename
    ? `attachment; filename*=UTF-8''${encodeURIComponent(
        options.filename.replace(/[\r\n/\\"]/g, "_"),
      ).replace(/'/g, "%27")}`
    : "inline";
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key,
      ResponseContentDisposition: disposition,
      ...(options.contentType
        ? { ResponseContentType: options.contentType }
        : {}),
    }),
    { expiresIn: options.expiresIn ?? 300 },
  );
}

/** Count objects this application manages, for the dashboard overview. */
export async function countManagedObjects() {
  const { client, bucket } = target();
  const countPrefix = async (Prefix: string) => {
    let total = 0;
    let token: string | undefined;
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix,
          MaxKeys: 1000,
          ContinuationToken: token,
        }),
      );
      total += page.KeyCount ?? page.Contents?.length ?? 0;
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return total;
  };
  const counts = await Promise.all(
    MANAGED_PREFIXES.map((prefix) => countPrefix(prefix)),
  );
  return counts.reduce((total, count) => total + count, 0);
}
