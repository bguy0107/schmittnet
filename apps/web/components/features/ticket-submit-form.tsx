"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocationContext, } from "@/hooks/use-dashboard";
import { useSubmitTicket } from "@/hooks/use-tickets";
import type { SubmitTicketResponse } from "@schmittnet/types";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp", "video/mp4", "video/quicktime"];
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

const schema = z.object({
  reporterName: z.string().min(1, "Your name is required").max(100),
  category: z.enum(["IT", "MAINTENANCE"], {
    errorMap: () => ({ message: "You must select a ticket category before submitting" }),
  }),
  description: z.string().min(10, "Describe the issue in at least 10 characters").max(2000),
  deadline: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

async function uploadFile(file: File): Promise<string> {
  // Step 1: get a presigned PUT URL
  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType: file.type, fileSizeBytes: file.size }),
  });
  if (!presignRes.ok) throw new Error("Failed to get upload URL");
  const { url, key } = (await presignRes.json()) as { url: string; key: string };

  // Step 2: PUT directly to MinIO
  const uploadRes = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadRes.ok) throw new Error("Media upload failed");

  return key;
}

export function TicketSubmitForm({ token }: { token: string }) {
  const { data: location, isLoading: locationLoading, isError: locationError } = useLocationContext(token);
  const submitTicket = useSubmitTicket(token);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmation, setConfirmation] = useState<SubmitTicketResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setMediaError(null);
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setMediaError("Unsupported file type. Use JPEG, PNG, HEIC, MP4, or MOV.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setMediaError("File is too large (max 100 MB).");
      return;
    }
    setMediaFile(file);
  }

  async function onSubmit(data: FormData) {
    if (!mediaFile) {
      setMediaError("A photo or video is required.");
      return;
    }

    setUploading(true);
    let mediaKey: string;
    try {
      mediaKey = await uploadFile(mediaFile);
    } catch {
      setMediaError("Upload failed. Please try again.");
      setUploading(false);
      return;
    }
    setUploading(false);

    const result = await submitTicket.mutateAsync({
      category: data.category,
      description: data.description,
      deadline: data.deadline || undefined,
      mediaKeys: [mediaKey],
      reporterName: data.reporterName,
    });

    setConfirmation(result);
  }

  if (locationLoading) {
    return <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>;
  }

  if (locationError || !location) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          This QR code is no longer active. Please contact your manager.
        </AlertDescription>
      </Alert>
    );
  }

  if (confirmation) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-gray-900">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ticket submitted!</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Your reference code is{" "}
          <strong className="font-mono text-base text-gray-900 dark:text-gray-100">{confirmation.referenceCode}</strong>
          . Take a note of it in case you need to follow up.
        </p>
      </div>
    );
  }

  const isDisabled = isSubmitting || uploading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900" noValidate>
      <div className="rounded-md bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
        📍 {location.name}
      </div>

      {submitTicket.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {submitTicket.error instanceof Error
              ? submitTicket.error.message
              : "Submission failed. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      {/* Reporter name */}
      <div className="space-y-1.5">
        <Label htmlFor="reporterName">
          Your name <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="reporterName"
          placeholder="First and last name"
          aria-invalid={!!errors.reporterName}
          {...register("reporterName")}
        />
        {errors.reporterName && (
          <p className="text-xs text-destructive">{errors.reporterName.message}</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category <span aria-hidden="true" className="text-destructive">*</span></Label>
        <div className="grid grid-cols-2 gap-3">
          {(["IT", "MAINTENANCE"] as const).map((cat) => (
            <label
              key={cat}
              className="flex cursor-pointer items-center justify-center rounded-md border-2 p-3 text-sm font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="radio" value={cat} {...register("category")} className="sr-only" />
              {cat === "IT" ? "🖥️ IT" : "🔧 Maintenance"}
            </label>
          ))}
        </div>
        {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Describe the issue — what's wrong, where it is, how long it's been happening…"
          rows={4}
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Deadline */}
      <div className="space-y-1.5">
        <Label htmlFor="deadline">Completion deadline <span className="text-gray-400">(optional)</span></Label>
        <input
          id="deadline"
          type="date"
          min={new Date().toISOString().split("T")[0]}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          {...register("deadline")}
        />
      </div>

      {/* Media upload */}
      <div className="space-y-1.5">
        <Label>
          Photo or video <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 py-6 text-sm text-gray-500 transition-colors hover:border-primary hover:bg-primary/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
          aria-describedby={mediaError ? "media-error" : undefined}
        >
          {mediaFile ? (
            <>
              <Camera className="h-6 w-6 text-green-500" />
              <span className="font-medium text-gray-700 dark:text-gray-200">{mediaFile.name}</span>
              <span className="text-xs text-gray-400">
                {(mediaFile.size / 1024 / 1024).toFixed(1)} MB — tap to change
              </span>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6" />
              <span>Tap to add photo or video</span>
              <span className="text-xs text-gray-400">JPEG, PNG, HEIC, MP4, MOV — max 100 MB</span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={handleFileChange}
          aria-label="Upload photo or video"
        />
        {mediaError && (
          <p id="media-error" className="text-xs text-destructive">{mediaError}</p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isDisabled}>
        {uploading ? "Uploading media…" : isSubmitting ? "Submitting…" : "Submit ticket"}
      </Button>
    </form>
  );
}
