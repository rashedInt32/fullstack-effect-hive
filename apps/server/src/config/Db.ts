import { Context, Effect, Layer, Data } from "effect";
import { Pool as PgPool } from "pg";
import type { Pool } from "pg";
import { AppConfig } from "./Config";
import { params } from "@effect/platform/HttpRouter";

// Need tagged error to
// Db layer that connects to database and run the sql query
// interface
// context
// live impl
const DbErrorCodes = [];
export class DbError extends Data.TaggedError("DbError")<{
  message: string;
  code:
    | "DATABASE_POOLING_FAILED"
    | "DATABASE_CLOSURE_FAILED"
    | "DATABASE_QUERY_FAILED"
    | "UNKNOWN_DATABASE_ERROR";
  cause?: unknown;
}> {}

export interface Db {
  pool: Pool;
  query: (
    sql: string,
    params: unknown[],
  ) => Effect.Effect<{ rows: unknown[] }, DbError>;
}

export const Db = Context.GenericTag<Db>("@service/db");

export const makePool = (databaseUrl: string) =>
  Effect.acquireRelease(
    Effect.promise(() =>
      Promise.resolve(new PgPool({ database: databaseUrl })),
    ).pipe(
      Effect.mapError(
        (err) =>
          new DbError({
            message: "Database pooling failed",
            code: "DATABASE_POOLING_FAILED",
            cause: `Pooling failed ${err}`,
          }),
      ),
    ),
    (pool) => Effect.sync(pool.end),
  );

export const makeQuery = (pool: Pool, sql: string, params: unknown[]) =>
  Effect.tryPromise({
    try: () => pool.query(sql, params),
    catch: (err) =>
      new DbError({
        message: "Database query failed",
        code: "DATABASE_QUERY_FAILED",
        cause: `query failed ${err}`,
      }),
  });

export const DbLive = Layer.scoped(
  Db,
  AppConfig.pipe(
    Effect.flatMap(({ DATABASE_URL }) =>
      makePool(DATABASE_URL).pipe(
        Effect.map((pool) => ({
          pool,
          query: (sql: string, params: unknown[]) =>
            makeQuery(pool, sql, params),
        })),
      ),
    ),
  ),
);
