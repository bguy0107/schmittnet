import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type {
  VideoRequestSummary,
  VideoRequestDetail,
  PaginatedResponse,
  SubmitVideoRequestResponse,
  SubmitVideoRequestInput,
  CreateVideoRequestInput,
} from "@schmittnet/types";

interface VideoRequestFilter {
  status?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

export function useVideoRequests(filter: VideoRequestFilter = {}) {
  return useQuery({
    queryKey: ["video-requests", filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter.status) params.set("status", filter.status);
      if (filter.locationId) params.set("locationId", filter.locationId);
      if (filter.page) params.set("page", String(filter.page));
      if (filter.pageSize) params.set("pageSize", String(filter.pageSize));
      return fetchApi<PaginatedResponse<VideoRequestSummary>>(`/api/video-requests?${params.toString()}`);
    },
  });
}

export function useVideoRequest(id: string) {
  return useQuery({
    queryKey: ["video-request", id],
    queryFn: () => fetchApi<VideoRequestDetail>(`/api/video-requests/${id}`),
    enabled: !!id,
  });
}

export function useSubmitVideoRequest(token: string) {
  return useMutation({
    mutationFn: (body: SubmitVideoRequestInput) =>
      fetchApi<SubmitVideoRequestResponse>(`/api/video-requests/submit/${token}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useCreateVideoRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVideoRequestInput) =>
      fetchApi<SubmitVideoRequestResponse>("/api/video-requests", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["video-requests"] }),
  });
}

export function useResolveVideoRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resolutionNote: string) =>
      fetchApi(`/api/video-requests/${id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ resolutionNote }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["video-request", id] });
      void qc.invalidateQueries({ queryKey: ["video-requests"] });
    },
  });
}

export function useCancelVideoRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) =>
      fetchApi(`/api/video-requests/${id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ note }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["video-request", id] });
      void qc.invalidateQueries({ queryKey: ["video-requests"] });
    },
  });
}
