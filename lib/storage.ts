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

function config() {
  const env = process.env;
  return {
    endpoint: env.AWS_ENDPOINT_URL_S3 || env.S3_ENDPOINT,
    region: env.AWS_REGION || env.S3_REGION || "auto",
    bucket: env.NEON_STORAGE_BUCKET || env.S3_BUCKET,
    accessKeyId: env.AWS_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY,
  };
}

export const storageConfigured = (() => {
  const c = config();
  return Boolean(
    c.endpoint && c.bucket && c.accessKeyId && c.secretAccessKey,
  );
})();

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
