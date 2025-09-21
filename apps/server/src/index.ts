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
import { Effect, Layer, Schema } from "effect";
import { createServer } from "node:http";
import { AppConfig, AppConfigLive } from "./config/Config";

const MyApi = HttpApi.make("MyApi").add(
  HttpApiGroup.make("greet")
    .add(HttpApiEndpoint.get("hello")`/`.addSuccess(Schema.String))
    .add(HttpApiEndpoint.get("goodbye")`/goodbye`.addSuccess(Schema.String)),
);

const GreetLive = HttpApiBuilder.group(MyApi, "greet", (handlers) => {
  return handlers
    .handle("hello", () => Effect.succeed("Hello world"))
    .handle("goodbye", () => Effect.succeed("Good bye"));
});

const MyApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(GreetLive));

const server = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(MyApiLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);

Layer.launch(server).pipe(NodeRuntime.runMain);

const program = Effect.gen(function* () {
  const { PORT } = yield* AppConfig;
  const client = yield* HttpApiClient.make(MyApi, {
    baseUrl: `http://localhost:${PORT}`,
  });

  const hello = yield* client.greet["hello"]();
  console.log(hello);
});

Effect.runFork(
  program.pipe(
    Effect.provide(Layer.merge(FetchHttpClient.layer, AppConfigLive)),
  ),
);
