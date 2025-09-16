import { Context, Effect, Layer, Data } from "effect";
import { Pool as PgPool } from "pg";
import type { Pool } from "pg";
import { AppConfig } from "./Config";

export class DbError extends Data.TaggedError("DbError")<{
  message: string;
  cause?: unknown;
  code:
    | "DB_POOLING_FAILED"
    | "DB_CLOUSER_FAILED"
    | "DB_QUERY_FAILED"
    | "UNKNOWN_ERROR";
}> {}

export interface Db {
  pool: Pool;
  query: (
    sql: string,
    params?: unknown[],
  ) => Effect.Effect<{ rows: unknown[] }, DbError>;
}

export const Db = Context.GenericTag<Db>("@service/db");

const makePool = (databaseUrl: string) =>
  Effect.promise(() =>
    Promise.resolve(new PgPool({ connectionString: databaseUrl })),
  ).pipe(
    Effect.mapError(
      (err) =>
        new DbError({
          message: `Failed to create DB pool: ${String(err)}`,
          code: "DB_POOLING_FAILED",
          cause: err,
        }),
    ),
  );

const runQuery = (
  pool: Pool,
  sql: string,
  params?: unknown[],
): Effect.Effect<{ rows: unknown[] }, DbError> =>
  Effect.promise(() =>
    pool.query(sql, params).then((r) => ({ rows: r.rows })),
  ).pipe(
    Effect.mapError(
      (err) =>
        new DbError({
          message: `DB query failed: ${String(err)}`,
          code: "DB_QUERY_FAILED",
          cause: err,
        }),
    ),
  );

export const DbLive = Layer.effect(
  Db,
  AppConfig.pipe(
    Effect.flatMap(({ DATABASE_URL }) =>
      makePool(DATABASE_URL).pipe(
        Effect.map((pool) => ({
          pool,
          query: (sql: string, params?: unknown[]) =>
            runQuery(pool, sql, params),
        })),
      ),
    ),
  ),
);
