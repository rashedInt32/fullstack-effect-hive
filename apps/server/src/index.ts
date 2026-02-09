import { HttpApiBuilder } from "@effect/platform";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer, Console, Effect } from "effect";
import { createServer } from "node:http";
import { DbLive } from "./config/Db";
import { JwtServiceLive } from "./jwt/JwtService";
import { AppConfig, AppConfigLive } from "./config/Config";
import { AuthServiceLive } from "./auth/AuthService";
import { RoomServiceLive } from "./room/RoomService";
import { RootApiLive } from "./api";
import { UserServiceLive } from "./user/UserService";
import { MessageServiceLive } from "./message/MessageService";
import { RealTimeBusLive } from "./realtime/RealtimeBus";
import { createWebSocketServer } from "./realtime/WebSocketServer";

const wsServer = createServer();

const WebSocketServerLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const wss = yield* createWebSocketServer(wsServer);

    wsServer.on("upgrade", (request, socket, head) => {
      if (request.url === "/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    wsServer.listen(3003, () => {
      console.log("WebSocket server listening on port 3003");
    });

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        wsServer.close();
        console.log("WebSocket server closed");
      }),
    );

    yield* Console.log("WebSocket server configured on port 3003");
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

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(
    HttpApiBuilder.middlewareCors({
      allowedOrigins: [corsOrigin],
      allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  ),
  Layer.provide(RootApiLive),

  Layer.provide(UserServiceLive),
  Layer.provide(RoomServiceLive),
  Layer.provide(MessageServiceLive),
  Layer.provide(AuthServiceLive),
  Layer.provide(JwtServiceLive),
  Layer.provide(RealTimeBusLive),

  Layer.provide(DbLive),
  Layer.provide(AppConfigLive),
  Layer.tap(() => Console.log("HTTP API server listening on port 3002")),
  Layer.provideMerge(WebSocketServerLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3002 })),
);

const MainLive = ServerLive;

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
