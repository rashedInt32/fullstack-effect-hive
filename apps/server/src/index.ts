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
import { DbLive } from "./config/Db";
import { UserSchema, UserServiceErrorSchema } from "@hive/shared";
import { UserService, UserServiceLive } from "./user/UserService";

// create httpApi
const MyApi = HttpApi.make("MyApi").add(
  HttpApiGroup.make("greet")
    .add(
      HttpApiEndpoint.get("hello", "/hello")
        .addSuccess(UserSchema)
        .addError(UserServiceErrorSchema),
    )
    .add(HttpApiEndpoint.get("goodbye", "/goodbye").addSuccess(Schema.String)),
);

const greetLive = HttpApiBuilder.group(MyApi, "greet", (handlers) =>
  handlers
    .handle("hello", () =>
      Effect.gen(function* () {
        const userService = yield* UserService;
        const user = yield* userService.create("david", "Pwd1234!");
        return user;
      }).pipe(
        Effect.mapError((err) => ({ code: err.code, message: err.message })),
      ),
    )
    .handle("goodbye", () => Effect.succeed("Goodbye")),
);

const MyApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(greetLive));

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(MyApiLive),
  Layer.provide(UserServiceLive),
  Layer.provide(DbLive),
  Layer.tap(() => Console.log("Server listenning at port 3002")),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3002 })),
);

Layer.launch(ServerLive).pipe(NodeRuntime.runMain);

const program = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(MyApi, {
    baseUrl: "http://localhost:3002",
  });

  const hello = yield* client.greet["hello"]();
  console.log(hello);
});

Effect.runFork(program.pipe(Effect.provide(FetchHttpClient.layer)));
