import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { DashboardStats, LocationContext } from "@schmittnet/types";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchApi<DashboardStats>("/api/reporting/dashboard"),
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
