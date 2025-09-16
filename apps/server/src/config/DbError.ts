import { Data } from "effect";

export class DbError extends Data.TaggedError("DbError")<{
  message: string;
  cause?: unknown;
  code:
    | "POOL_CREATION_FAILED"
    | "POOL_CLOSURE_FAILED"
    | "QUERY_FAILED"
    | "UNKNOWN_ERROR";
}> {}
