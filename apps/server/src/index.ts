import {
  FetchHttpClient,
  HttpApi,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSwagger,
} from "@effect/platform";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Schema, Console } from "effect";
import { createServer } from "node:http";
import { AppConfig, AppConfigLive } from "./config/Config";
import { Db, DbLive } from "./config/Db";

const UserScheme = Schema.Struct({
  username: Schema.String,
  email: Schema.String,
  password: Schema.String,
});

type User = Schema.Schema.Type<typeof UserScheme>;

// create httpApi
const MyApi = HttpApi.make("MyApi").add(
  HttpApiGroup.make("greet")
    .add(HttpApiEndpoint.get("hello", "/hellow").addSuccess(UserScheme))
    .add(HttpApiEndpoint.get("goodbye", "/goodbuye").addSuccess(Schema.String)),
);

const greetLive = HttpApiBuilder.group(MyApi, "greet", (handlers) =>
  handlers.handle("hello", () =>
    Effect.gen(function* () {
      const sql = yield* Db;
      const user = yield* sql`SELECT username, email, password FROM USER WHERE email = ${"admin@admin.com"} `;

      return user[0] as User;
    }),
  ).handle("goodbye", () => Effect.succeed("Goodbye"),
);
