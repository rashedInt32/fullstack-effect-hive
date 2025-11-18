import { Effect } from "effect";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api";

export const apiFetch = <T>(input: string, init: RequestInit) =>
  Effect.tryPromise({
    try: () => fetch(input, init),
    catch: (err) => new Error("Fetch failed", { cause: err as Error }),
  }).pipe(
    Effect.flatMap((res) =>
      res.ok
        ? Effect.tryPromise(() => res.json() as Promise<T>)
        : Effect.fail(new Error(`${res.status}`)),
    ),
  );
