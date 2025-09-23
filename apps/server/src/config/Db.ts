import { Effect, Redacted } from "effect";
import { AppConfig } from "./Config";
import { SqlClient } from "@effect/sql";
import { PgClient } from "@effect/sql-pg";

export const Db = SqlClient.SqlClient;

export const DbLive = Effect.gen(function* () {
  const { DATABASE_URL } = yield* AppConfig;
  return PgClient.layer({ url: Redacted.make(DATABASE_URL), ssl: true });
});
