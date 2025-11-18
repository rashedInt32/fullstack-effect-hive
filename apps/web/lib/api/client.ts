import { tokenStorage } from "@/lib/api/storage";
import { ApiError } from "@/lib/api/types";
import { apiFetch } from "@/lib/apiFetch";
import { Effect } from "effect";
import { Room, RoomCreate, User, UserRow } from "@hive/shared";

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
    return response;
  }).pipe(
    Effect.catchAll((err) => {
      if (err instanceof Error) {
        const apiError = new ApiError(
          err.message,
          "FETCH_ERROR",
          err.message.includes("401") ? 401 : 500,
        );
        return Effect.fail(apiError);
      }
      return Effect.fail(new ApiError("Unknown error", "UNKNOWN_ERROR", 500));
    }),
  );

export const apiClient = {
  auth: {
    login: (email: string, password: string) =>
      apiFetchWithAuth<User & { token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }).pipe(
        Effect.tap((data) => Effect.sync(() => tokenStorage.set(data.token))),
      ),
    signup: (username: string, password: string, email?: string) =>
      apiFetchWithAuth<User & { token: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username, password, email }),
      }).pipe(
        Effect.tap((data) => Effect.sync(() => tokenStorage.set(data.token))),
      ),
  },
  user: {
    profile: () => apiFetchWithAuth<User>("/user/profile", { method: "GET" }),
  },

  rooms: {
    create: (data: RoomCreate) =>
      apiFetchWithAuth<Room>("/rooms/create", {
        method: "POST",
        body: JSON.stringify({ data }),
      }),
  },
};
