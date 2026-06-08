"use client";

import { useRef } from "react";
import { FileVideo, Loader2, Plus, RotateCw, Upload, X } from "lucide-react";
import type { MediaUploadItem } from "@/hooks/use-media-uploads";

/** Thumbnail grid + picker for attaching multiple photos/videos, with per-item upload status. */
export function MediaUploadList({
  items,
  onAdd,
  onRemove,
  onRetry,
  canAddMore,
  maxFiles,
  acceptedTypes,
  addLabel = "Tap to add photos or videos",
}: {
  items: MediaUploadItem[];
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  canAddMore: boolean;
  maxFiles: number;
  acceptedTypes: string[];
  addLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) onAdd(e.target.files);
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
            >
              {item.file.type.startsWith("video/") ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-gray-400 dark:text-gray-500">
                  <FileVideo className="h-6 w-6" />
                  <span className="line-clamp-2 text-center text-[10px] leading-tight text-gray-500 dark:text-gray-400">{item.file.name}</span>
                </div>
              ) : (
                <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
              )}

              {item.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="h-5 w-5 animate-spin text-white" aria-label="Uploading" />
                </div>
              )}

              {item.status === "error" && (
                <button
                  type="button"
                  onClick={() => onRetry(item.id)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/85 text-white"
                >
                  <RotateCw className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Failed — tap to retry</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label="Remove attachment"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {canAddMore && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 py-5 text-sm text-gray-500 transition-colors hover:border-primary hover:bg-primary/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
        >
          {items.length > 0 ? <Plus className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
          <span>{items.length > 0 ? "Add more" : addLabel}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            JPEG, PNG, HEIC, MP4, MOV — up to {maxFiles}, max 100 MB each
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(",")}
        className="hidden"
        onChange={handleChange}
        aria-label="Add photos or videos"
      />
    </div>
  );
}
