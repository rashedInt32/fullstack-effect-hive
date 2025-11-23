import { Effect } from "effect";
import { ApiError } from "./api/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api";

const parseJson = (text: string) =>
  Effect.try({
    try: () => JSON.parse(text),
    catch: () => ({ message: text }),
  });

export const apiFetch = <T>(url: string, init?: RequestInit) =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(API_URL + url, {
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        ...init,
      });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text };
      }

      if (!res.ok) {
        throw new ApiError({
          message: body.message ?? `HTTP ${res.status}`,
          code: body.code ?? "HTTP_ERROR",
          status: res.status,
        });
      }
      return body as T;
    },

    // ❗ will ONLY fire if fetch itself fails (DNS, offline, CORS)
    catch: (error) => {
      if (error instanceof ApiError) {
        return error;
      }

      if (error instanceof Error) {
        return new ApiError({
          message: error.message,
          code: "NETWORK_ERROR",
          cause: error,
        });
      }

      return new ApiError({
        message: "Unknown error",
        code: "NETWORK_ERROR",
        cause: error,
      });
    },
  });
