"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Image as ImageIcon, FileVideo } from "lucide-react";
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
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string };
  }>;
  media: Array<{ id: string; storageKey: string; mediaType: "PHOTO" | "VIDEO"; mimeType: string }>;
  approvals: Array<{
    id: string;
    status: "PENDING" | "APPROVED" | "DECLINED";
    notes: string | null;
    createdAt: string;
    requester: { id: string; name: string };
  }>;
}

function statusVariant(status: TicketStatus) {
  switch (status) {
    case "OPEN": return "info" as const;
    case "IN_PROGRESS": return "warning" as const;
    case "AWAITING_APPROVAL": return "destructive" as const;
    case "RESOLVED": return "success" as const;
    default: return "secondary" as const;
  }
}

const TERMINAL = new Set<TicketStatus>(["RESOLVED", "CANCELLED"]);

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

  const [noteContent, setNoteContent] = useState("");
  const [onHoldReason, setOnHoldReason] = useState("");
  const [showOnHoldForm, setShowOnHoldForm] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"APPROVE" | "DECLINE" | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

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
            <Badge variant="outline">{t.category}</Badge>
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
            {t.deadline && (
              <div>
                <dt className="font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Deadline</dt>
                <dd className="mt-0.5 text-gray-500 dark:text-gray-400">{formatDateTime(t.deadline)}</dd>
              </div>
            )}
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
                <div
                  key={m.id}
                  className="flex h-16 w-16 items-center justify-center rounded-md border bg-gray-50 text-gray-300 dark:bg-gray-800 dark:text-gray-600"
                >
                  {m.mediaType === "VIDEO" ? (
                    <FileVideo className="h-6 w-6" />
                  ) : (
                    <ImageIcon className="h-6 w-6" />
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Media preview requires signed read URLs — not yet wired up.
            </p>
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
                {!showOnHoldForm ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowOnHoldForm(true)}>
                      Put On Hold
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus.mutate({ status: "AWAITING_APPROVAL" })}
                      disabled={updateStatus.isPending}
                    >
                      Request Approval
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateStatus.mutate({ status: "RESOLVED" })}
                      disabled={updateStatus.isPending}
                    >
                      Mark Resolved
                    </Button>
                  </div>
                ) : (
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

            {t.status === "AWAITING_APPROVAL" && isOwner && pendingApproval && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Approval requested by <strong>{pendingApproval.requester.name}</strong>
                  {" · "}
                  {formatDateTime(pendingApproval.createdAt)}
                </p>
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
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Waiting on owner approval — requested by{" "}
                <strong className="text-gray-700 dark:text-gray-200">
                  {pendingApproval.requester.name}
                </strong>{" "}
                on {formatDateTime(pendingApproval.createdAt)}.
              </p>
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

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium">
            Notes{t.notes.length > 0 ? ` (${t.notes.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {t.notes.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">No notes yet.</p>
          )}
          {t.notes.map((note) => (
            <div key={note.id} className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span className="font-medium text-gray-600 dark:text-gray-300">{note.author.name}</span>
                <span>·</span>
                <span>{formatDateTime(note.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200">{note.content}</p>
            </div>
          ))}

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
