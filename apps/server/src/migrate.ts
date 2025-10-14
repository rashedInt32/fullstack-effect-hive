import "dotenv/config";
import { Effect, Console } from "effect";
import { Db, DbLive } from "./config/Db";
import { AppConfigLive } from "./config/Config";
import { join } from "path";
import { readFileSync } from "fs";

const sqlFiles = [
  "user/UserModel.sql",
  "room/RoomModel.sql",
  "message/MessageModel.sql",
  "invitation/InvitationModel.sql",
];

const migrate = Effect.gen(function* () {
  yield* Console.log("Migration starts...");
  const DB = yield* Db;
  let combinedSql = "";

  for (const file of sqlFiles) {
    const sql = readFileSync(join(__dirname, file), "utf-8");
    combinedSql += sql + "\n";
  }

  yield* DB.unsafe(combinedSql);
  yield* Console.log("Migration completed successfully");
}).pipe(Effect.provide(AppConfigLive));

// Merge layers properly

Effect.runPromise(migrate.pipe(Effect.provide(DbLive)));
