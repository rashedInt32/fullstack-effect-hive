import { apiFetch } from "@/lib/apiFetch";
import { Effect } from "effect";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

const apiFetchWithAuth = <T>(url: string, options?: RequestInit) =>
  Effect.gen(function* () {
    const token = localStorage.get();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    };

    const response = apiFetch<T>(API_URL + url, {
      ...options,
      headers,
    });

    return response;
  });
