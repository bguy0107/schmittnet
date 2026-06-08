"use client";

import { useCallback, useState } from "react";

export const MEDIA_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp", "video/mp4", "video/quicktime"];
export const MEDIA_MAX_BYTES = 100 * 1024 * 1024;
export const MEDIA_MAX_FILES = 5;

export type MediaUploadStatus = "uploading" | "done" | "error";

export interface MediaUploadItem {
  id: string;
  file: File;
  previewUrl: string;
  status: MediaUploadStatus;
  key?: string;
}

let nextId = 0;

async function uploadToStorage(file: File): Promise<string> {
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

/** Manages selecting, uploading, retrying, and removing multiple photo/video attachments. */
export function useMediaUploads(maxFiles = MEDIA_MAX_FILES) {
  const [items, setItems] = useState<MediaUploadItem[]>([]);
  const [rejection, setRejection] = useState<string | null>(null);

  const runUpload = useCallback((id: string, file: File) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "uploading", key: undefined } : it)));
    uploadToStorage(file)
      .then((key) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "done", key } : it))))
      .catch(() => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "error" } : it))));
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const room = maxFiles - items.length;
      if (room <= 0) {
        setRejection(`You can attach up to ${maxFiles} files.`);
        return;
      }

      const accepted: File[] = [];
      let skippedForRoom = false;
      let skippedForType = false;
      let skippedForSize = false;

      for (const file of Array.from(fileList)) {
        if (accepted.length >= room) {
          skippedForRoom = true;
          break;
        }
        if (!MEDIA_ACCEPTED_TYPES.includes(file.type)) {
          skippedForType = true;
          continue;
        }
        if (file.size > MEDIA_MAX_BYTES) {
          skippedForSize = true;
          continue;
        }
        accepted.push(file);
      }

      if (skippedForType) setRejection("Unsupported file type. Use JPEG, PNG, HEIC, MP4, or MOV.");
      else if (skippedForSize) setRejection("Files must be 100 MB or smaller.");
      else if (skippedForRoom) setRejection(`Only ${room} more file(s) can be attached — limit is ${maxFiles}.`);
      else setRejection(null);

      const newItems: MediaUploadItem[] = accepted.map((file) => ({
        id: `media-${++nextId}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
      }));

      if (newItems.length === 0) return;
      setItems((prev) => [...prev, ...newItems]);
      newItems.forEach((item) => runUpload(item.id, item.file));
    },
    [items.length, maxFiles, runUpload],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const retryItem = useCallback(
    (id: string) => {
      const target = items.find((it) => it.id === id);
      if (target) runUpload(id, target.file);
    },
    [items, runUpload],
  );

  const reset = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return [];
    });
    setRejection(null);
  }, []);

  return {
    items,
    rejection,
    addFiles,
    removeItem,
    retryItem,
    reset,
    isUploading: items.some((it) => it.status === "uploading"),
    hasErrors: items.some((it) => it.status === "error"),
    keys: items.filter((it) => it.status === "done" && it.key).map((it) => it.key as string),
    canAddMore: items.length < maxFiles,
    maxFiles,
    acceptedTypes: MEDIA_ACCEPTED_TYPES,
  };
}
