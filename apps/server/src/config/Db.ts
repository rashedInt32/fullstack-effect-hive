import { Effect, Redacted, Layer } from "effect";
import { AppConfig, AppConfigLive } from "./Config";
import { PgClient } from "@effect/sql-pg";
import { SqlClient } from "@effect/sql";

export const Db = SqlClient.SqlClient;

export const DbLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const { DATABASE_URL } = yield* AppConfig;
    return PgClient.layer({ url: Redacted.make(DATABASE_URL), ssl: true });
  }).pipe(Effect.provide(AppConfigLive)),
);
