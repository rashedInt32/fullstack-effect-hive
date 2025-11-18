import { HttpApiBuilder } from "@effect/platform";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer, Console, Effect } from "effect";
import { createServer } from "node:http";
import { DbLive } from "./config/Db";
import { JwtServiceLive } from "./jwt/JwtService";
import { AppConfigLive } from "./config/Config";
import { AuthServiceLive } from "./auth/AuthService";
import { RoomServiceLive } from "./room/RoomService";
import { RootApiLive } from "./api";
import { UserServiceLive } from "./user/UserService";
import { MessageServiceLive } from "./message/MessageService";
import { RealTimeBusLive } from "./realtime/RealtimeBus";
import { createWebSocketServer } from "./realtime/WebSocketServer";

const httpServer = createServer();

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(RootApiLive),

  Layer.provide(UserServiceLive),
  Layer.provide(RoomServiceLive),
  Layer.provide(MessageServiceLive),
  Layer.provide(AuthServiceLive),
  Layer.provide(JwtServiceLive),
  Layer.provide(RealTimeBusLive),

  Layer.provide(DbLive),
  Layer.provide(AppConfigLive),
  Layer.tap(() => Console.log("Server listenning at port ")),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3002 })),
);

const WebSocketServerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* createWebSocketServer(httpServer);
  }),
).pipe(
  Layer.provide(UserServiceLive),
  Layer.provide(RoomServiceLive),
  Layer.provide(MessageServiceLive),
  Layer.provide(JwtServiceLive),
  Layer.provide(RealTimeBusLive),
  Layer.provide(DbLive),
  Layer.provide(AppConfigLive),
);

const MainLive = Layer.mergeAll(ServerLive, WebSocketServerLive);

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
