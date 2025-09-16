import { Context, Effect, Layer } from "effect";
import { Pool as PgPool } from "pg";
import type { Pool } from "pg";
import { AppConfig } from "./Config";

export interface Db {
  pool: Pool;
  query: (
    sql: string,
    params?: unknown[],
  ) => Effect.Effect<{ rows: any[] }, Error>;
}

export const Db = Context.GenericTag<Db>("@services/Db");

const createPool = (databaseUrl: string): Promise<Pool> =>
  Promise.resolve(new PgPool({ connectionString: databaseUrl }));

export const DbLive = Layer.scoped(
  Db,
  Effect.gen(function* () {
    const { DATABASE_URL } = yield* AppConfig;
    const pool = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => createPool(DATABASE_URL),
        catch: (err) => new Error(`Failed to create DB pool: ${String(err)}`),
      }),
      (pool) =>
        Effect.orDie(
          Effect.tryPromise({
            try: () => pool.end(),
            catch: (err) =>
              new Error(`Failed to close DB pool: ${String(err)}`),
          }),
        ),
    );
    const db: Db = {
      pool,
      query: (sql, params) =>
        Effect.tryPromise({
          try: () => pool.query(sql, params).then((r) => ({ rows: r.rows })),
          catch: (err) => new Error(`DB query failed: ${String(err)}`),
        }),
    };
    return db;
  }),
);
