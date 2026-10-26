"use client";

// Gọi API khu vực Admin từ trình duyệt; lỗi trả về theo quy ước SRS { code, message, requestId, details? }.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public requestId?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.code ?? "ERROR", body.message ?? `Lỗi ${res.status}`, body.details, body.requestId);
  }
  return body as T;
}
