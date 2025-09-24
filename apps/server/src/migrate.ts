import "dotenv/config";
import { Console, Effect } from "effect";
import { join } from "path";
import { Db, DbLive } from "./config/Db";
import { readFileSync } from "fs";
import { AppConfigLive } from "./config/Config";

const sqlFiels = ["user/UserModel.sql"];

const migrate = Effect.gen(function* () {
  yield* Console.log("Migration starts...");
  const DB = yield* Db;
  let combinedSql = "";

  for (const file of sqlFiels) {
    const filePath = join(__dirname, file);
    const sql = readFileSync(filePath, "utf-8");
    combinedSql += sql + "\n";
  }
  yield* DB.unsafe(combinedSql);

  yield* Console.log("Migration completed successfully");
});

Effect.runPromise(
  Effect.gen(function* () {
    const dbLayer = yield* DbLive;
    return yield* migrate.pipe(Effect.provide(dbLayer));
  }).pipe(Effect.provide(AppConfigLive)),
);
