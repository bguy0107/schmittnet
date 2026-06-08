import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { z } from "zod";
import { s3, BUCKET, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, toPublicUrl } from "@/src/lib/minio";
import { toApiError, ValidationError, RateLimitError } from "@/src/lib/errors";
import { getClientIp } from "@/src/lib/request-ip";
import { enforcePresignRateLimit } from "@/src/proxy/rate-limit";

const presignSchema = z.object({
  mimeType: z.string().refine((t) => ALLOWED_MIME_TYPES.has(t), {
    message: "Unsupported file type",
  }),
  fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const body: unknown = await req.json().catch(() => null);

  try {
    await enforcePresignRateLimit(ip);
    const { mimeType, fileSizeBytes } = presignSchema.parse(body);

    const ext = mimeType.split("/")[1] ?? "bin";
    const key = `uploads/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: mimeType,
      ContentLength: fileSizeBytes,
    });

    // Short-lived URL — client must upload within 5 minutes.
    const url = toPublicUrl(await getSignedUrl(s3, command, { expiresIn: 300 }));

    return NextResponse.json({ url, key });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(toApiError(new ValidationError("Invalid request", error.issues)), {
        status: 400,
      });
    }
    if (error instanceof ValidationError || error instanceof RateLimitError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}
