import { Layer, Console } from "effect";
import { HttpApiBuilder, HttpApiSwagger } from "@effect/platform";

import { NodeHttpServer } from "@effect/platform-node";
import { createServer } from "node:http";
import { MyApiLive } from "./api";
import { UserServiceLive } from "./user/UserService";
import { DbLive } from "./config/Db";

export const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(MyApiLive),
  Layer.provide(UserServiceLive),
  Layer.provide(DbLive),
  Layer.tap(() => Console.log("Server listenning at port 3002")),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3002 })),
);
