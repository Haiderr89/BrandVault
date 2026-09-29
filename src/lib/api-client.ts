"use client";

import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Network error. Check your connection and try again.");
  }
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    window.location.replace("/login");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.message ?? `Request failed (${res.status}).`,
      data?.error?.details,
    );
  }
  return data as T;
}

/** Minimal data hook with loading / error / reload. Pass null to skip. */
export function useApi<T>(path: string | null) {
  const [nonce, setNonce] = useState(0);
  const key = path ? `${nonce}:${path}` : null;
  // `settledKey` is the request the current data/error belong to; while it
  // differs from `key` a request is in flight. Stale data is kept meanwhile.
  const [state, setState] = useState<{ settledKey: string | null; data: T | null; error: ApiError | null }>({
    settledKey: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!path || !key) return;
    const ctrl = new AbortController();
    api<T>(path, { signal: ctrl.signal })
      .then((data) => setState({ settledKey: key, data, error: null }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        const error = err instanceof ApiError ? err : new ApiError(0, String(err));
        setState((s) => ({ settledKey: key, data: s.data, error }));
      });
    return () => ctrl.abort();
  }, [path, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (update: T | null | ((prev: T | null) => T | null)) =>
      setState((s) => ({
        ...s,
        data: typeof update === "function" ? (update as (p: T | null) => T | null)(s.data) : update,
      })),
    [],
  );
  const loading = key !== null && state.settledKey !== key;
  return { data: state.data, error: loading ? null : state.error, loading, reload, setData };
}
