import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

function pick(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

const endpoint = pick(["S3_ENDPOINT", "AWS_ENDPOINT_URL_S3"]);
const bucket = pick(["S3_BUCKET", "NEON_STORAGE_BUCKET"]);
const region = pick(["S3_REGION", "AWS_REGION"]) ?? "auto";
const accessKeyId = pick(["S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"]);
const secretAccessKey = pick(["S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]);

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey)
  throw Error(
    "Set the Neon Object Storage variables in .env.local before configuring CORS.",
  );

const normalize = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim();
  }
};

const origins = [
  ...(process.env.APP_ORIGINS || "").split(","),
  ...process.argv.slice(2),
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.BETTER_AUTH_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]
  .filter((origin): origin is string => Boolean(origin?.trim()))
  .map(normalize);
const allowed = [...new Set(origins)];
if (!allowed.length)
  throw Error("Set APP_ORIGINS or NEXT_PUBLIC_APP_URL before configuring CORS.");

const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: { accessKeyId, secretAccessKey },
  requestChecksumCalculation: "WHEN_REQUIRED",
});

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: allowed,
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
console.log("Bucket CORS updated for:", allowed.join(", "));
