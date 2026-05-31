import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { DashboardStats, LocationContext } from "@schmittnet/types";

export function useDashboard(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.size > 0 ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["dashboard", from, to],
    queryFn: () => fetchApi<DashboardStats>(`/api/reporting/dashboard${qs}`),
  });
}

export function useLocationContext(token: string) {
  return useQuery({
    queryKey: ["location-context", token],
    queryFn: () => fetchApi<LocationContext>(`/api/tickets/submit/${token}`),
    staleTime: Infinity,
    retry: 1,
  });
}
