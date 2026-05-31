import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

const protocol = env.MINIO_USE_SSL ? "https" : "http";
const internalBase = `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;
const publicBase = env.MINIO_PUBLIC_URL.replace(/\/$/, "");

// S3-compatible client pointed at self-hosted MinIO.
// forcePathStyle is required for MinIO (it does not use virtual-hosted-style URLs).
export const s3 = new S3Client({
  endpoint: internalBase,
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

// Rewrites a presigned URL from the internal Docker endpoint to the public-facing
// one so browsers can reach it. The HMAC signature remains valid because Caddy
// forwards Host: minio:9000 to MinIO (see infra/Caddyfile).
export function toPublicUrl(internalUrl: string): string {
  return internalUrl.replace(internalBase, publicBase);
}

export async function getSignedReadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const internalUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return toPublicUrl(internalUrl);
}
