import { Effect } from "effect";
import { ApiError } from "./api/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api";

const parseJson = (text: string) =>
  Effect.try({
    try: () => JSON.parse(text),
    catch: () => ({ message: text }),
  });

export const apiFetch = <T>(url: string, init?: RequestInit) =>
  Effect.gen(function* () {
    const res = yield* Effect.promise(() =>
      fetch(API_URL + url, {
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        ...init,
      }),
    );

    const text = yield* Effect.promise(() => res.text());
    const body = yield* parseJson(text);

    if (!res.ok) {
      return yield* Effect.fail(
        new ApiError({
          message: body.message ?? "Response not ok",
          code: body.code ?? "HTTP_ERROR",
          status: body.status ?? res.status,
        }),
      );
    }

    return body as T;
  }).pipe(
    Effect.catchAllDefect((error) =>
      Effect.fail(
        new ApiError({
          message: error instanceof Error ? error.message : "Network error",
          code: "NETWORK_ERROR",
        }),
      ),
    ),
  );
