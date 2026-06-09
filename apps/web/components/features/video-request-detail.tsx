"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useVideoRequest, useResolveVideoRequest, useCancelVideoRequest } from "@/hooks/use-video-requests";
import { formatDateTime } from "@schmittnet/utils";
import type { Role, VideoRequestStatus, RequestingParty } from "@schmittnet/types";

function statusVariant(status: VideoRequestStatus) {
  switch (status) {
    case "OPEN": return "destructive" as const;
    case "RESOLVED": return "success" as const;
    case "CANCELLED": return "secondary" as const;
  }
}

function statusLabel(status: VideoRequestStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function partyLabel(party: RequestingParty): string {
  return party === "LAW_ENFORCEMENT" ? "Law Enforcement" : "Internal";
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

const resolveSchema = z.object({
  resolutionNote: z.string().min(1, "Resolution note is required").max(2000),
});

const cancelSchema = z.object({
  note: z.string().max(500).optional(),
});

interface VideoRequestDetailProps {
  requestId: string;
  role: Role;
}

export function VideoRequestDetail({ requestId, role }: VideoRequestDetailProps) {
  const { data: req, isLoading, isError } = useVideoRequest(requestId);
  const resolve = useResolveVideoRequest(requestId);
  const cancel = useCancelVideoRequest(requestId);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);

  const resolveForm = useForm<{ resolutionNote: string }>({
    resolver: zodResolver(resolveSchema),
  });

  const cancelForm = useForm<{ note?: string }>({
    resolver: zodResolver(cancelSchema),
  });

  const canResolve = req?.status === "OPEN" && (role === "TECHNICIAN" || role === "SUPER_ADMIN");
  const canCancel = req?.status === "OPEN" && (role === "SUPER_ADMIN" || role === "OWNER" || role === "OWNER_STAFF");

  async function onResolve(data: { resolutionNote: string }) {
    await resolve.mutateAsync(data.resolutionNote);
    setShowResolveForm(false);
  }

  async function onCancel(data: { note?: string }) {
    await cancel.mutateAsync(data.note);
    setShowCancelForm(false);
  }

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  }

  if (isError || !req) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load video request.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={"/video-requests" as Route}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Video Requests
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(req.status)}>{statusLabel(req.status)}</Badge>
            <Badge variant="secondary">{partyLabel(req.requestingParty)}</Badge>
          </div>
          <span className="font-mono text-sm text-gray-400 dark:text-gray-500">
            #{req.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Location" value={req.location.name} />
          <DetailRow label="Camera / Area" value={req.cameraAreas} />
          <DetailRow label="Footage Start" value={formatDateTime(req.footageStart)} />
          <DetailRow label="Footage End" value={formatDateTime(req.footageEnd)} />
          <DetailRow label="Submitter" value={req.submitterName} />
          <DetailRow label="Contact" value={req.submitterContact} />
          <DetailRow label="Submitted" value={formatDateTime(req.createdAt)} />
          {req.submittedBy && <DetailRow label="Submitted By" value={req.submittedBy.name ?? req.submittedBy.id} />}
        </dl>

        {req.requestingParty === "LAW_ENFORCEMENT" && req.officerContactDetails && (
          <div className="mt-4 rounded-md border border-gray-200 p-4 dark:border-gray-700">
            <DetailRow label="Officer Contact Details" value={req.officerContactDetails} />
          </div>
        )}

        {req.status === "RESOLVED" && (
          <div className="mt-4 rounded-md bg-green-50 p-4 dark:bg-green-900/20">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-400">Resolution</p>
            <p className="mt-1 text-sm text-green-800 dark:text-green-300">{req.resolutionNote}</p>
            {req.resolvedBy && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-500">
                Resolved by {req.resolvedBy.name ?? req.resolvedBy.id} · {req.resolvedAt ? formatDateTime(req.resolvedAt) : ""}
              </p>
            )}
          </div>
        )}

        {req.status === "CANCELLED" && req.cancellationNote && (
          <div className="mt-4 rounded-md bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Cancellation Note</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{req.cancellationNote}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {(canResolve || canCancel) && !showResolveForm && !showCancelForm && (
        <div className="flex flex-wrap gap-3">
          {canResolve && (
            <Button onClick={() => setShowResolveForm(true)}>Mark Resolved</Button>
          )}
          {canCancel && (
            <Button variant="outline" onClick={() => setShowCancelForm(true)}>Cancel Request</Button>
          )}
        </div>
      )}

      {showResolveForm && (
        <form
          onSubmit={resolveForm.handleSubmit(onResolve)}
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Resolve Request</h3>

          {resolve.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {resolve.error instanceof Error ? resolve.error.message : "Failed to resolve request."}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="resolutionNote">
              Resolution note <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Textarea
              id="resolutionNote"
              placeholder="Describe what footage was retrieved and how it was delivered…"
              rows={3}
              aria-invalid={!!resolveForm.formState.errors.resolutionNote}
              {...resolveForm.register("resolutionNote")}
            />
            {resolveForm.formState.errors.resolutionNote && (
              <p className="text-xs text-destructive">{resolveForm.formState.errors.resolutionNote.message}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={resolveForm.formState.isSubmitting || resolve.isPending}>
              {resolve.isPending ? "Saving…" : "Confirm Resolution"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowResolveForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {showCancelForm && (
        <form
          onSubmit={cancelForm.handleSubmit(onCancel)}
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Cancel Request</h3>

          {cancel.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {cancel.error instanceof Error ? cancel.error.message : "Failed to cancel request."}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cancelNote">Reason <span className="text-gray-400 dark:text-gray-500">(optional)</span></Label>
            <Textarea
              id="cancelNote"
              placeholder="Reason for cancellation…"
              rows={2}
              {...cancelForm.register("note")}
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="destructive" disabled={cancelForm.formState.isSubmitting || cancel.isPending}>
              {cancel.isPending ? "Cancelling…" : "Confirm Cancellation"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowCancelForm(false)}>Back</Button>
          </div>
        </form>
      )}
    </div>
  );
}
