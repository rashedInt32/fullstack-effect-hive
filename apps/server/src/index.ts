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

// Shared infrastructure layers — a single instance of each service is shared
// across both the HTTP API and the WebSocket handler. This is critical for
// RealTimeBusLive: both must publish/subscribe on the SAME PubSub so that
// messages sent via WebSocket (or REST) are visible to all subscribers.

// Base layers (no external requirements)
const BaseLive = Layer.mergeAll(DbLive, RealTimeBusLive);

// JwtService requires AppConfig
const JwtLive = JwtServiceLive.pipe(Layer.provide(AppConfigLive));

// Infrastructure: base layers + JWT
const InfraLive = Layer.mergeAll(BaseLive, JwtLive);

// Application service layers (all depend on Db, RealTimeBus, JwtService)
const SharedLive = Layer.mergeAll(
  UserServiceLive,
  RoomServiceLive,
  MessageServiceLive,
  AuthServiceLive,
).pipe(Layer.provide(InfraLive));

// Merge so that both SharedLive services AND InfraLive services are available
const AllServicesLive = Layer.provideMerge(SharedLive, InfraLive);

// ---------- WebSocket server on port 3003 ----------
const wsHttpServer = createServer();

const WebSocketServerLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const wss = yield* createWebSocketServer(wsHttpServer);

    wsHttpServer.on("upgrade", (request, socket, head) => {
      if (request.url === "/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        wss.close();
      }),
    );

    wsHttpServer.listen(3003, () => {
      // Server started
    });

    yield* Console.log("WebSocket server listening on port 3003");
  }),
).pipe(Layer.provide(AllServicesLive));

// ---------- HTTP API server on port 3002 ----------
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
  Layer.provide(AllServicesLive),
  Layer.tap(() => Console.log("HTTP API server listening on port 3002")),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3002 })),
);

// ---------- Launch both ----------
const MainLive = Layer.mergeAll(ServerLive, WebSocketServerLive);

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
