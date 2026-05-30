import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type {
  TicketSummary,
  TicketDetail,
  PaginatedResponse,
  SubmitTicketResponse,
} from "@schmittnet/types";

interface TicketFilter {
  status?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export function useTickets(filter: TicketFilter = {}) {
  return useQuery({
    queryKey: ["tickets", filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter.status) params.set("status", filter.status);
      if (filter.category) params.set("category", filter.category);
      if (filter.page) params.set("page", String(filter.page));
      if (filter.pageSize) params.set("pageSize", String(filter.pageSize));
      return fetchApi<PaginatedResponse<TicketSummary>>(`/api/tickets?${params.toString()}`);
    },
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchApi<TicketDetail>(`/api/tickets/${id}`),
    enabled: !!id,
  });
}

export function useUpdateTicketStatus(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { status: string; onHoldReason?: string }) =>
      fetchApi(`/api/tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useAddNote(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      fetchApi(`/api/tickets/${ticketId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });
}

export function useClaimTicket(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchApi(`/api/tickets/${ticketId}/claim`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useSubmitTicket(token: string) {
  return useMutation({
    mutationFn: (body: {
      category: string;
      description: string;
      urgency: string;
      deadline?: string;
      mediaKeys: string[];
    }) =>
      fetchApi<SubmitTicketResponse>(`/api/tickets/submit/${token}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
