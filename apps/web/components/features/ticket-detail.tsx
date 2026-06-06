"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, FileVideo } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  useTicket,
  useUpdateTicketStatus,
  useAddNote,
  useClaimTicket,
  useResolveApproval,
  useUpdateTicketDeadline,
} from "@/hooks/use-tickets";
import { formatDateTime, statusLabel, priorityLabel } from "@schmittnet/utils";
import type { Role, TicketStatus } from "@schmittnet/types";

// Actual shape returned by GET /api/tickets/[id] (Prisma row, not @schmittnet/types TicketDetail)
interface TicketRow {
  id: string;
  category: "IT" | "MAINTENANCE";
  status: TicketStatus;
  priority: "P0" | "P1" | "P2" | "NORMAL";
  description: string;
  deadline: string | null;
  onHoldReason: string | null;
  resolvedAt: string | null;
  createdAt: string;
  location: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  history: Array<{
    id: string;
    type: "NOTE" | "STATUS_CHANGE";
    content: string | null;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: string;
    author: { id: string; name: string | null } | null;
  }>;
  media: Array<{ id: string; storageKey: string; mediaType: "PHOTO" | "VIDEO"; mimeType: string; signedUrl: string }>;
  approvals: Array<{
    id: string;
    status: "PENDING" | "APPROVED" | "DECLINED";
    approvalReason: string | null;
    notes: string | null;
    createdAt: string;
    requester: { id: string; name: string };
  }>;
}

function statusVariant(status: TicketStatus) {
  switch (status) {
    case "OPEN": return "destructive" as const;
    case "IN_PROGRESS": return "warning" as const;
    case "ON_HOLD": return "orange" as const;
    case "AWAITING_APPROVAL": return "pink" as const;
    case "APPROVED": return "success" as const;
    case "RESOLVED": return "success" as const;
    case "CANCELLED": return "success" as const;
    default: return "secondary" as const;
  }
}

function categoryVariant(category: string) {
  return category === "IT" ? "purple" as const : "silver" as const;
}

function categoryLabel(category: string) {
  return category === "IT" ? "IT" : "Maintenance";
}

const TERMINAL = new Set<TicketStatus>(["RESOLVED", "CANCELLED"]);

function ResolveForm({ value, onChange, onSubmit, onCancel, isPending }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Resolution note (optional)</p>
      <Textarea
        placeholder="Describe what was done to resolve this ticket…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit} disabled={isPending}>
          Confirm Resolved
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface Props {
  ticketId: string;
  userId: string;
  role: Role;
}

export function TicketDetail({ ticketId, userId, role }: Props) {
  const { data, isLoading, isError } = useTicket(ticketId);
  const updateStatus = useUpdateTicketStatus(ticketId);
  const addNote = useAddNote(ticketId);
  const claimTicket = useClaimTicket(ticketId);
  const resolveApproval = useResolveApproval(ticketId);
  const updateDeadline = useUpdateTicketDeadline(ticketId);

  const [noteContent, setNoteContent] = useState("");
  const [showDeadlineForm, setShowDeadlineForm] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState("");
  const [onHoldReason, setOnHoldReason] = useState("");
  const [showOnHoldForm, setShowOnHoldForm] = useState(false);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalReason, setApprovalReason] = useState("");
  const [approvalAction, setApprovalAction] = useState<"APPROVE" | "DECLINE" | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelNote, setCancelNote] = useState("");

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>;
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Ticket not found or you don&apos;t have access.</AlertDescription>
        </Alert>
        <Link href="/tickets" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to tickets
        </Link>
      </div>
    );
  }

  const t = data as unknown as TicketRow;
  const isTech = role === "TECHNICIAN" || role === "SUPER_ADMIN";
  const isOwner = role === "OWNER" || role === "OWNER_STAFF" || role === "SUPER_ADMIN";
  const pendingApproval = t.approvals?.[0] ?? null;
  const isTerminal = TERMINAL.has(t.status);
  void userId; // available for future assignee-gating if needed

  function handleClaimAndStart() {
    claimTicket.mutate(undefined, {
      onSuccess: () => updateStatus.mutate({ status: "IN_PROGRESS" }),
    });
  }

  function handleOnHoldSubmit() {
    if (!onHoldReason.trim()) return;
    updateStatus.mutate(
      { status: "ON_HOLD", onHoldReason },
      { onSuccess: () => { setShowOnHoldForm(false); setOnHoldReason(""); } },
    );
  }

  function handleApprovalSubmit() {
    if (!approvalAction || !pendingApproval) return;
    resolveApproval.mutate(
      {
        approvalId: pendingApproval.id,
        status: approvalAction === "APPROVE" ? "APPROVED" : "DECLINED",
        notes: approvalNotes || undefined,
      },
      { onSuccess: () => { setApprovalAction(null); setApprovalNotes(""); } },
    );
  }

  function handleAddNote() {
    if (!noteContent.trim()) return;
    addNote.mutate(noteContent, { onSuccess: () => setNoteContent("") });
  }

  function handleResolveSubmit() {
    updateStatus.mutate(
      { status: "RESOLVED", note: resolveNote.trim() || undefined },
      { onSuccess: () => { setShowResolveForm(false); setResolveNote(""); } },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        All tickets
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {t.priority === "P0" && <span aria-label="Service-impacting">🚨</span>}
            <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
              #{t.id.slice(0, 8).toUpperCase()}
            </span>
            <Badge variant={statusVariant(t.status)}>{statusLabel(t.status)}</Badge>
            <Badge variant={categoryVariant(t.category)}>{categoryLabel(t.category)}</Badge>
            {t.priority !== "NORMAL" && (
              <Badge variant={t.priority === "P0" ? "destructive" : "secondary"}>
                {priorityLabel(t.priority)}
              </Badge>
            )}
          </div>

          <p className="mt-3 text-sm leading-relaxed text-gray-800 dark:text-gray-100">
            {t.description}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Location</dt>
              <dd className="mt-0.5 text-gray-700 dark:text-gray-300">{t.location.name}</dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Assigned to</dt>
              <dd className="mt-0.5 text-gray-700 dark:text-gray-300">{t.assignee?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Opened</dt>
              <dd className="mt-0.5 text-gray-500 dark:text-gray-400">{formatDateTime(t.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Deadline</dt>
              <dd className="mt-0.5 text-gray-500 dark:text-gray-400">
                {t.deadline ? formatDateTime(t.deadline) : <span className="italic text-gray-400 dark:text-gray-600">None</span>}
              </dd>
            </div>
            {t.resolvedAt && (
              <div>
                <dt className="font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Resolved</dt>
                <dd className="mt-0.5 text-gray-500 dark:text-gray-400">{formatDateTime(t.resolvedAt)}</dd>
              </div>
            )}
          </dl>

          {t.onHoldReason && (
            <div className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-sm dark:bg-yellow-900/20">
              <span className="font-medium text-yellow-800 dark:text-yellow-300">On hold: </span>
              <span className="text-yellow-700 dark:text-yellow-400">{t.onHoldReason}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Media */}
      {t.media.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium">
              Attachments ({t.media.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {t.media.map((m) => (
                <a
                  key={m.id}
                  href={m.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-gray-50 dark:bg-gray-800"
                >
                  {m.mediaType === "VIDEO" ? (
                    <>
                      <video
                        src={m.signedUrl}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40">
                        <FileVideo className="h-6 w-6 text-white" />
                      </div>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.signedUrl}
                      alt="Ticket attachment"
                      className="h-full w-full object-cover group-hover:opacity-90"
                    />
                  )}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {(isTech || isOwner) && !isTerminal && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {t.status === "OPEN" && isTech && !t.assignee && (
              <Button
                className="w-full"
                onClick={handleClaimAndStart}
                disabled={claimTicket.isPending || updateStatus.isPending}
              >
                Claim &amp; Start
              </Button>
            )}

            {t.status === "IN_PROGRESS" && isTech && (
              <>
                {!showOnHoldForm && !showApprovalForm && !showResolveForm && !showCancelForm ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowOnHoldForm(true)}>
                      Put On Hold
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowApprovalForm(true)}
                    >
                      Request Approval
                    </Button>
                    <Button size="sm" onClick={() => setShowResolveForm(true)}>
                      Mark Resolved
                    </Button>
                  </div>
                ) : showOnHoldForm ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Reason for hold…"
                      value={onHoldReason}
                      onChange={(e) => setOnHoldReason(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleOnHoldSubmit}
                        disabled={!onHoldReason.trim() || updateStatus.isPending}
                      >
                        Confirm Hold
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowOnHoldForm(false); setOnHoldReason(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : showApprovalForm ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      What needs to be approved?
                    </p>
                    <Textarea
                      placeholder="Describe what requires owner approval…"
                      value={approvalReason}
                      onChange={(e) => setApprovalReason(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!approvalReason.trim()) return;
                          updateStatus.mutate(
                            { status: "AWAITING_APPROVAL", approvalReason },
                            { onSuccess: () => { setShowApprovalForm(false); setApprovalReason(""); } },
                          );
                        }}
                        disabled={!approvalReason.trim() || updateStatus.isPending}
                      >
                        Submit Request
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowApprovalForm(false); setApprovalReason(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ResolveForm
                    value={resolveNote}
                    onChange={setResolveNote}
                    onSubmit={handleResolveSubmit}
                    onCancel={() => { setShowResolveForm(false); setResolveNote(""); }}
                    isPending={updateStatus.isPending}
                  />
                )}
              </>
            )}

            {t.status === "ON_HOLD" && isTech && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => updateStatus.mutate({ status: "IN_PROGRESS" })}
                disabled={updateStatus.isPending}
              >
                Resume Work
              </Button>
            )}

            {t.status === "APPROVED" && isTech && (
              !showResolveForm ? (
                <Button className="w-full" onClick={() => setShowResolveForm(true)}>
                  Mark Resolved
                </Button>
              ) : (
                <ResolveForm
                  value={resolveNote}
                  onChange={setResolveNote}
                  onSubmit={handleResolveSubmit}
                  onCancel={() => { setShowResolveForm(false); setResolveNote(""); }}
                  isPending={updateStatus.isPending}
                />
              )
            )}

            {t.status === "AWAITING_APPROVAL" && isOwner && pendingApproval && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Approval requested by <strong>{pendingApproval.requester.name}</strong>
                  {" · "}
                  {formatDateTime(pendingApproval.createdAt)}
                </p>
                {pendingApproval.approvalReason && (
                  <div className="rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/60">
                    <span className="font-medium text-gray-700 dark:text-gray-200">What needs approval: </span>
                    <span className="text-gray-600 dark:text-gray-300">{pendingApproval.approvalReason}</span>
                  </div>
                )}
                {!approvalAction ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setApprovalAction("APPROVE")}>Approve</Button>
                    <Button variant="outline" size="sm" onClick={() => setApprovalAction("DECLINE")}>
                      Decline
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {approvalAction === "APPROVE" ? "Approving" : "Declining"} — notes (optional)
                    </p>
                    <Textarea
                      placeholder="Notes…"
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={approvalAction === "DECLINE" ? "destructive" : "default"}
                        onClick={handleApprovalSubmit}
                        disabled={resolveApproval.isPending}
                      >
                        {approvalAction === "APPROVE" ? "Confirm Approval" : "Confirm Decline"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setApprovalAction(null); setApprovalNotes(""); }}
                      >
                        Back
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {t.status === "AWAITING_APPROVAL" && isTech && !isOwner && pendingApproval && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Waiting on owner approval — requested by{" "}
                  <strong className="text-gray-700 dark:text-gray-200">
                    {pendingApproval.requester.name}
                  </strong>{" "}
                  on {formatDateTime(pendingApproval.createdAt)}.
                </p>
                {pendingApproval.approvalReason && (
                  <div className="rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/60">
                    <span className="font-medium text-gray-700 dark:text-gray-200">Approval for: </span>
                    <span className="text-gray-600 dark:text-gray-300">{pendingApproval.approvalReason}</span>
                  </div>
                )}
              </div>
            )}

            {/* Deadline — show add button only when no deadline is set */}
            {!t.deadline && !showDeadlineForm && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => { setDeadlineValue(""); setShowDeadlineForm(true); }}
              >
                Add deadline
              </Button>
            )}
            {showDeadlineForm && (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Set a completion deadline</p>
                <input
                  type="date"
                  value={deadlineValue}
                  onChange={(e) => setDeadlineValue(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-gray-900"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!deadlineValue || updateDeadline.isPending}
                    onClick={() =>
                      updateDeadline.mutate(
                        deadlineValue ? new Date(deadlineValue).toISOString() : null,
                        { onSuccess: () => setShowDeadlineForm(false) },
                      )
                    }
                  >
                    {updateDeadline.isPending ? "Saving…" : "Save deadline"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeadlineForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
                {updateDeadline.isError && (
                  <p className="text-xs text-destructive">Failed to save deadline — please try again.</p>
                )}
              </div>
            )}

            {/* Cancel — available to techs and owners while not terminal */}
            {!showCancelForm ? (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  setShowOnHoldForm(false); setOnHoldReason("");
                  setShowApprovalForm(false); setApprovalReason("");
                  setShowResolveForm(false); setResolveNote("");
                  setShowCancelForm(true);
                }}
              >
                Cancel ticket
              </Button>
            ) : (
              <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">Cancel this ticket?</p>
                <Textarea
                  placeholder="Reason for cancellation (optional)…"
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={updateStatus.isPending}
                    onClick={() =>
                      updateStatus.mutate(
                        { status: "CANCELLED", note: cancelNote.trim() || undefined },
                        { onSuccess: () => { setShowCancelForm(false); setCancelNote(""); } },
                      )
                    }
                  >
                    {updateStatus.isPending ? "Cancelling…" : "Confirm cancel"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowCancelForm(false); setCancelNote(""); }}
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}

            {(updateStatus.isError || claimTicket.isError) && (
              <p className="text-xs text-destructive">Action failed — please try again.</p>
            )}
            {resolveApproval.isError && (
              <p className="text-xs text-destructive">Failed to resolve approval — please try again.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium">
            History{t.history.length > 0 ? ` (${t.history.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {t.history.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">No history yet.</p>
          )}
          {[...t.history].reverse().map((entry) =>
            entry.type === "STATUS_CHANGE" ? (
              <div key={entry.id} className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-400 dark:bg-blue-500" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {entry.fromStatus
                      ? `${statusLabel(entry.fromStatus as never)} → ${statusLabel(entry.toStatus as never)}`
                      : "Ticket opened"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {entry.author?.name ?? "System"} · {formatDateTime(entry.createdAt)}
                  </p>
                </div>
              </div>
            ) : (
              <div key={entry.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <span className="font-medium text-gray-600 dark:text-gray-300">{entry.author?.name ?? "Staff"}</span>
                  <span>·</span>
                  <span>{formatDateTime(entry.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200">{entry.content}</p>
              </div>
            )
          )}

          {isTech && !isTerminal && (
            <div className="space-y-2 border-t pt-4">
              <Textarea
                placeholder="Add a note…"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={2}
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!noteContent.trim() || addNote.isPending}
              >
                Add Note
              </Button>
              {addNote.isError && (
                <p className="text-xs text-destructive">Failed to add note — please try again.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
