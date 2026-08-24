import type { Config } from "../config.js";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  apiUrl: string,
  path: string,
  init: RequestInit,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(new URL(path, apiUrl), { ...init, headers });
  } catch (err) {
    throw new ApiError(`Could not reach ${apiUrl}: ${(err as Error).message}`, 0);
  }

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(`Bad response from ${path} (${res.status})`, res.status);
  }

  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `${path} failed with ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export function apiRequestNoAuth<T>(apiUrl: string, path: string, init: RequestInit): Promise<T> {
  return request<T>(apiUrl, path, init);
}

export function apiRequest<T>(
  apiUrl: string,
  config: Config,
  path: string,
  init: RequestInit,
): Promise<T> {
  return request<T>(apiUrl, path, init, config.token);
}
