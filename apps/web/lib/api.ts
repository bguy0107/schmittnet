import type { ApiError } from "@schmittnet/types";

class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch((): ApiError => ({
      error: { code: "UNKNOWN", message: "Request failed" },
    }));
    const err = (body as ApiError).error;
    throw new ApiRequestError(err.code, err.message, res.status);
  }

  return res.json() as Promise<T>;
}

export { ApiRequestError };
