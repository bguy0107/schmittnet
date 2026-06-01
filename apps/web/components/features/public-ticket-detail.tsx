"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Upload, FileVideo, CheckCircle2 } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BadgeProps } from "@/components/ui/badge";

// ── Types ────────────────────────────────────────────────────────────────────

interface PublicNote {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null } | null;
}

interface PublicMedia {
  id: string;
  storageKey: string;
  mediaType: "PHOTO" | "VIDEO";
  mimeType: string;
  signedUrl: string;
}

type TicketStatus = "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "AWAITING_APPROVAL" | "RESOLVED" | "CANCELLED";

interface PublicTicketDetailData {
  id: string;
  category: "IT" | "MAINTENANCE";
  status: TicketStatus;
  priority: string;
  description: string;
  deadline: string | null;
  onHoldReason: string | null;
  resolvedAt: string | null;
  createdAt: string;
  location: { id: string; name: string };
  assignee: { id: string; name: string | null } | null;
  notes: PublicNote[];
  media: PublicMedia[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  AWAITING_APPROVAL: "Awaiting Approval",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
};

const STATUS_VARIANT: Record<TicketStatus, BadgeProps["variant"]> = {
  OPEN: "info",
  IN_PROGRESS: "warning",
  ON_HOLD: "warning",
  AWAITING_APPROVAL: "warning",
  RESOLVED: "success",
  CANCELLED: "secondary",
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp", "video/mp4", "video/quicktime"];
const MAX_BYTES = 100 * 1024 * 1024;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { token: string; ticketId: string }

export function PublicTicketDetail({ token, ticketId }: Props) {
  const qc = useQueryClient();
  const apiBase = `/api/tickets/submit/${token}/tickets/${ticketId}`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-ticket", token, ticketId],
    queryFn: () => fetchApi<PublicTicketDetailData>(apiBase),
  });

  // Cancel state
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      fetchApi(`${apiBase}/cancel`, { method: "PATCH", body: JSON.stringify({ reason }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-ticket", token, ticketId] }),
  });

  // Deadline state
  const [showDeadline, setShowDeadline] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState("");
  const deadlineMutation = useMutation({
    mutationFn: (deadline: string | null) =>
      fetchApi(`${apiBase}/deadline`, { method: "PATCH", body: JSON.stringify({ deadline }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-ticket", token, ticketId] });
      setShowDeadline(false);
      setDeadlineValue("");
    },
  });

  // Note + media state
  const [noteContent, setNoteContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteMutation = useMutation({
    mutationFn: async ({ content, file }: { content: string; file: File | null }) => {
      let mediaKeys: string[] | undefined;
      if (file) {
        setUploading(true);
        try { mediaKeys = [await uploadFile(file)]; }
        finally { setUploading(false); }
      }
      return fetchApi(`${apiBase}/notes`, {
        method: "POST",
        body: JSON.stringify({ content, mediaKeys }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-ticket", token, ticketId] });
      setNoteContent("");
      setMediaFile(null);
      setMediaError(null);
    },
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

  if (isLoading) return <div className="py-16 text-center text-sm text-gray-500">Loading…</div>;
  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Ticket not found or this QR code is no longer active.</AlertDescription>
      </Alert>
    );
  }

  const t = data;
  const isTerminal = t.status === "RESOLVED" || t.status === "CANCELLED";

  if (cancelMutation.isSuccess) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-900">Ticket cancelled</h2>
        <p className="mt-1 text-sm text-gray-500">
          Reference <strong className="font-mono">{t.id.slice(0, 8).toUpperCase()}</strong> has been cancelled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {t.priority === "P0" && <span aria-label="Service-impacting">🚨</span>}
          <span className="font-mono text-xs text-gray-400">#{t.id.slice(0, 8).toUpperCase()}</span>
          <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABELS[t.status]}</Badge>
          <Badge variant="outline">{t.category === "IT" ? "🖥️ IT" : "🔧 Maintenance"}</Badge>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-gray-800">{t.description}</p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="font-medium uppercase tracking-wide text-gray-400">Location</dt>
            <dd className="mt-0.5 text-gray-700">📍 {t.location.name}</dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-wide text-gray-400">Opened</dt>
            <dd className="mt-0.5 text-gray-500">{formatDate(t.createdAt)}</dd>
          </div>
          {t.deadline && (
            <div>
              <dt className="font-medium uppercase tracking-wide text-gray-400">Deadline</dt>
              <dd className="mt-0.5 text-gray-500">{formatDateOnly(t.deadline)}</dd>
            </div>
          )}
          {t.resolvedAt && (
            <div>
              <dt className="font-medium uppercase tracking-wide text-gray-400">Resolved</dt>
              <dd className="mt-0.5 text-gray-500">{formatDate(t.resolvedAt)}</dd>
            </div>
          )}
        </dl>

        {t.onHoldReason && (
          <div className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-sm">
            <span className="font-medium text-yellow-800">On hold: </span>
            <span className="text-yellow-700">{t.onHoldReason}</span>
          </div>
        )}
      </div>

      {/* Media */}
      {t.media.length > 0 && (
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-gray-700">Attachments ({t.media.length})</p>
          <div className="flex flex-wrap gap-2">
            {t.media.map((m) => (
              <a
                key={m.id}
                href={m.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-gray-50"
              >
                {m.mediaType === "VIDEO" ? (
                  <>
                    <video src={m.signedUrl} className="h-full w-full object-cover" muted preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40">
                      <FileVideo className="h-6 w-6 text-white" />
                    </div>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.signedUrl} alt="Ticket attachment" className="h-full w-full object-cover group-hover:opacity-90" />
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!isTerminal && (
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm space-y-3">
          <p className="text-sm font-medium text-gray-700">Actions</p>

          {/* Deadline */}
          {!showDeadline ? (
            <Button variant="outline" size="sm" onClick={() => {
              setShowDeadline(true);
              setDeadlineValue(t.deadline ? t.deadline.slice(0, 10) : "");
            }}>
              {t.deadline ? "Update deadline" : "Set deadline"}
            </Button>
          ) : (
            <div className="space-y-2">
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={deadlineValue}
                onChange={(e) => setDeadlineValue(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!deadlineValue || deadlineMutation.isPending}
                  onClick={() => deadlineMutation.mutate(deadlineValue ? new Date(deadlineValue).toISOString() : null)}
                >
                  {deadlineMutation.isPending ? "Saving…" : "Save deadline"}
                </Button>
                {t.deadline && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deadlineMutation.isPending}
                    onClick={() => deadlineMutation.mutate(null)}
                  >
                    Remove
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowDeadline(false)}>
                  Cancel
                </Button>
              </div>
              {deadlineMutation.isError && (
                <p className="text-xs text-destructive">Failed to update deadline — please try again.</p>
              )}
            </div>
          )}

          {/* Cancel (OPEN only) */}
          {t.status === "OPEN" && (
            <>
              {!showCancel ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:border-red-400 hover:bg-red-50"
                  onClick={() => setShowCancel(true)}
                >
                  Cancel ticket
                </Button>
              ) : (
                <div className="space-y-2 rounded-md border border-red-100 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-800">Cancel this ticket?</p>
                  <Textarea
                    placeholder="Reason for cancellation (required)…"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={2}
                    className="bg-white"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!cancelReason.trim() || cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(cancelReason)}
                    >
                      {cancelMutation.isPending ? "Cancelling…" : "Confirm cancel"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowCancel(false); setCancelReason(""); }}>
                      Back
                    </Button>
                  </div>
                  {cancelMutation.isError && (
                    <p className="text-xs text-destructive">Failed to cancel — please try again.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm space-y-4">
        <p className="text-sm font-medium text-gray-700">
          Notes{t.notes.length > 0 ? ` (${t.notes.length})` : ""}
        </p>

        {t.notes.length === 0 && (
          <p className="text-sm text-gray-400">No notes yet.</p>
        )}

        {t.notes.map((note) => (
          <div key={note.id} className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="font-medium text-gray-600">
                {note.author?.name ?? "Staff"}
              </span>
              <span>·</span>
              <span>{formatDate(note.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-700">{note.content}</p>
          </div>
        ))}

        {!isTerminal && (
          <div className="space-y-2 border-t pt-4">
            <Textarea
              placeholder="Add a note…"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={2}
            />

            {/* Media attachment */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 py-4 text-sm text-gray-500 transition-colors hover:border-primary hover:bg-primary/5"
            >
              {mediaFile ? (
                <>
                  <Camera className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-gray-700">{mediaFile.name}</span>
                  <span className="text-xs text-gray-400">{(mediaFile.size / 1024 / 1024).toFixed(1)} MB — tap to change</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span>Attach photo or video (optional)</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={handleFileChange}
              aria-label="Attach photo or video"
            />
            {mediaError && <p className="text-xs text-destructive">{mediaError}</p>}

            <Button
              size="sm"
              disabled={!noteContent.trim() || noteMutation.isPending || uploading}
              onClick={() => noteMutation.mutate({ content: noteContent, file: mediaFile })}
            >
              {uploading ? "Uploading…" : noteMutation.isPending ? "Saving…" : "Add note"}
            </Button>
            {noteMutation.isError && (
              <p className="text-xs text-destructive">Failed to add note — please try again.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
