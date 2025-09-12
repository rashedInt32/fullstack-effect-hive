// Create api definitions
// Implement live implementations for the api group
// Implement live main api and provide http group
// Start the server
// Launch the server with node http server and node runtime

import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSwagger,
} from "@effect/platform";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Schema } from "effect";
import { createServer } from "node:http";

const MyApi = HttpApi.make("MyApi").add(
  HttpApiGroup.make("greet")
    .add(HttpApiEndpoint.get("hello")`/`.addSuccess(Schema.String))
    .add(HttpApiEndpoint.get("goodbye")`/goodbye`.addSuccess(Schema.String)),
);

const greetLive = HttpApiBuilder.group(MyApi, "greet", (handlers) => {
  return handlers
    .handle("hello", () => Effect.succeed("Hello worrld"))
    .handle("goodbye", () => Effect.succeed("Goodbye "));
});

const myApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(greetLive));

const server = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(myApiLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);

Layer.launch(server).pipe(NodeRuntime.runMain);
