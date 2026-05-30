import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

const protocol = env.MINIO_USE_SSL ? "https" : "http";

// S3-compatible client pointed at self-hosted MinIO.
// forcePathStyle is required for MinIO (it does not use virtual-hosted-style URLs).
export const s3 = new S3Client({
  endpoint: `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

export const BUCKET = env.MINIO_BUCKET;

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB — revisit based on storage budget
