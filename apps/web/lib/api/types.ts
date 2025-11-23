import { Data } from "effect";

export class ApiError extends Data.TaggedError("ApiError")<{
  readonly message: string;
  readonly code: string;
  readonly status?: number;
  readonly cause?: unknown;
}> {}

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };
