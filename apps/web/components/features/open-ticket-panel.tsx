"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOpenTicket } from "@/hooks/use-tickets";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp", "video/mp4", "video/quicktime"];
const MAX_BYTES = 100 * 1024 * 1024;

const schema = z.object({
  locationId: z.string().min(1, "Select a location"),
  category: z.enum(["IT", "MAINTENANCE"], { required_error: "Select a category" }),
  description: z.string().min(10, "Describe the issue in at least 10 characters").max(2000),
  deadline: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

async function uploadFile(file: File): Promise<string> {
  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType: file.type, fileSizeBytes: file.size }),
  });
  if (!presignRes.ok) throw new Error("Failed to get upload URL");
  const { url, key } = (await presignRes.json()) as { url: string; key: string };

  const uploadRes = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!uploadRes.ok) throw new Error("Media upload failed");
  return key;
}

export function OpenTicketPanel({
  locations,
  onClose,
}: {
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const openTicket = useOpenTicket();
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
    let mediaKeys: string[] | undefined;

    if (mediaFile) {
      setUploading(true);
      try {
        mediaKeys = [await uploadFile(mediaFile)];
      } catch {
        setMediaError("Upload failed. Please try again.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    await openTicket.mutateAsync({
      locationId: data.locationId,
      category: data.category,
      description: data.description,
      deadline: data.deadline || undefined,
      mediaKeys,
    });

    onClose();
  }

  const isDisabled = isSubmitting || uploading || openTicket.isPending;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Open ticket</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 text-lg leading-none">
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-5 p-4">
          {openTicket.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {openTicket.error instanceof Error ? openTicket.error.message : "Submission failed."}
              </AlertDescription>
            </Alert>
          )}

          {/* Location */}
          <div className="space-y-1">
            <Label htmlFor="ot-location">
              Location <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <select
              id="ot-location"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-gray-900"
              {...register("locationId")}
            >
              <option value="">— Select location —</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            {errors.locationId && <p className="text-xs text-destructive">{errors.locationId.message}</p>}
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
            <Label htmlFor="ot-description">
              Description <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Textarea
              id="ot-description"
              placeholder="Describe the issue — what's wrong, where it is, how long it's been happening…"
              rows={4}
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label htmlFor="ot-deadline">
              Completion deadline <span className="text-gray-400">(optional)</span>
            </Label>
            <input
              id="ot-deadline"
              type="date"
              min={new Date().toISOString().split("T")[0]}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("deadline")}
            />
          </div>

          {/* Media — optional */}
          <div className="space-y-1.5">
            <Label>
              Photo or video <span className="text-gray-400">(optional)</span>
            </Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 py-5 text-sm text-gray-500 transition-colors hover:border-primary hover:bg-primary/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
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
            {mediaError && <p className="text-xs text-destructive">{mediaError}</p>}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={isDisabled}>
              {uploading ? "Uploading…" : isSubmitting || openTicket.isPending ? "Opening…" : "Open ticket"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isDisabled}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
