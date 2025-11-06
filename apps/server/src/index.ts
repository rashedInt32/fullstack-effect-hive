import {
  FetchHttpClient,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiSwagger,
} from "@effect/platform";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer, Console } from "effect";
import { createServer } from "node:http";
import { DbLive } from "./config/Db";
import { UserServiceLive } from "./user/UserService";
import { UserApiLive } from "./api/routes/userRoute";
import { JwtServiceLive } from "./jwt/JwtService";
import { AppConfigLive } from "./config/Config";
import { AuthServiceLive } from "./auth/AuthService";
import { RoomsApiLive } from "./api/routes/roomRoute";
import { RoomServiceLive } from "./room/RoomService";
import { MessageApiLive } from "./api/routes/messageRoute";
import { MessageServiceLive } from "./message/MessageService";

const ApisLive = Layer.mergeAll(UserApiLive, MessageApiLive, RoomsApiLive);

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(RoomsApiLive),
  Layer.provide(MessageApiLive),
  Layer.provide(UserApiLive),

  Layer.provide(UserServiceLive),
  Layer.provide(MessageServiceLive),
  Layer.provide(RoomServiceLive),

  Layer.provide(AuthServiceLive),
  Layer.provide(JwtServiceLive),

  Layer.provide(DbLive),
  Layer.provide(AppConfigLive),
  Layer.tap(() => Console.log("Server listenning at port ")),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3002 })),
);

Layer.launch(ServerLive).pipe(NodeRuntime.runMain);

// const program = Effect.gen(function* () {
//   const client = yield* HttpApiClient.make(MyApi, {
//     baseUrl: "http://localhost:3002",
//   });
//
//   const hello = yield* client.greet["hello"]();
//   console.log(hello);
// });
//
// Effect.runFork(program.pipe(Effect.provide(FetchHttpClient.layer)));
