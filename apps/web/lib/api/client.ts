import { ApiError } from "@/lib/api/types";
import { apiFetch } from "@/lib/apiFetch";
import { Effect } from "effect";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api";

const apiFetchWithAuth = <T>(url: string, options?: RequestInit) =>
  Effect.gen(function* () {
    const token = localStorage.get();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    };

    const response = yield* apiFetch<T>(API_URL + url, {
      ...options,
      headers,
    });
  }).pipe(
    Effect.catchAll((error) => {
      if (error instanceof Error) {
        const apiError = new ApiError(
          error.message,
          "FETCH_ERROR",
          error.message.includes("401") ? 401 : 500,
        );
        return Effect.fail(apiError);
      }
      return Effect.fail(new ApiError("Unknown Error", "UNKNOWN_ERROR"));
    }),
  );
