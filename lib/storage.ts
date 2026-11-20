import "server-only";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
function target() {
  const {
    S3_ENDPOINT: endpoint,
    S3_BUCKET: Bucket,
    S3_ACCESS_KEY_ID: accessKeyId,
    S3_SECRET_ACCESS_KEY: secretAccessKey,
  } = process.env;
  if (!endpoint || !Bucket || !accessKeyId || !secretAccessKey)
    throw Error("Storage unavailable");
  return {
    client: new S3Client({
      endpoint,
      region: process.env.S3_REGION || "auto",
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
    Bucket,
  };
}
export async function upload(
  Key: string,
  Body: Uint8Array,
  ContentType: string,
) {
  const { client, Bucket } = target();
  await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }));
}
export async function remove(Key: string) {
  const { client, Bucket } = target();
  await client.send(new DeleteObjectCommand({ Bucket, Key }));
}
export async function signed(Key: string, filename?: string) {
  const { client, Bucket } = target();
  await client.send(new HeadObjectCommand({ Bucket, Key }));
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket,
      Key,
      ResponseContentDisposition: filename
        ? `attachment; filename*=UTF-8''${encodeURIComponent(filename.replace(/[\r\n/\\]/g, "_")).replace(/'/g, "%27")}`
        : "inline",
    }),
    { expiresIn: 120 },
  );
}
