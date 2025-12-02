import {
  RoomEvent,
  WSClientMessageSchema,
  WSServerMessage,
} from "@hive/shared";
import { Console, Effect, Fiber, Ref, Runtime, Schema, Stream } from "effect";
import { WebSocket, WebSocketServer as WSServer } from "ws";
import { JwtService } from "../jwt/JwtService";
import { MessageService } from "../message/MessageService";
import { RoomService } from "../room/RoomService";
import { UserService } from "../user/UserService";
import { RealTimeBus } from "./RealtimeBus";

interface ConnectionState {
  userId: string | null;
  username: string | null;
  authenticated: boolean;
  subscribedRooms: Set<string>;
  streamFiber: Fiber.Fiber<void, never> | null;
}

const createInitialState = (): ConnectionState => ({
  userId: null,
  username: null,
  authenticated: false,
  subscribedRooms: new Set(),
  streamFiber: null,
});

const sendMessage = (
  ws: WebSocket,
  message: WSServerMessage,
): Effect.Effect<void> =>
  Effect.try(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }).pipe(
    Effect.catchAll((error) =>
      Console.error("Failed to send WebSocket message:", error),
    ),
  );

const sendError = (
  ws: WebSocket,
  code: string,
  message: string,
): Effect.Effect<void> =>
  sendMessage(ws, {
    type: "error",
    code,
    message,
  });

const handleAuthentication = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  token: string,
) =>
  Effect.gen(function* () {
    const jwtService = yield* JwtService;
    const userService = yield* UserService;

    const payload = yield* jwtService.verify(token).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* sendError(ws, "AUTH_FAILED", "Invalid token");
          return yield* Effect.fail(error);
        }),
      ),
    );

    const user = yield* userService.findById(payload.id).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* sendError(ws, "USER_NOT_FOUND", "User not found");
          return yield* Effect.fail(error);
        }),
      ),
    );

    yield* Ref.update(state, (s) => ({
      ...s,
      userId: user.id,
      username: user.username,
      authenticated: true,
    }));

    yield* sendMessage(ws, {
      type: "authenticated",
      userId: user.id,
      username: user.username,
    });

    yield* Console.log(
      `WebSocket authenticated: ${user.username} (${user.id})`,
    );
  });

const startEventStream = (ws: WebSocket, state: Ref.Ref<ConnectionState>) =>
  Effect.gen(function* () {
    const bus = yield* RealTimeBus;
    const currentState = yield* Ref.get(state);

    if (currentState.subscribedRooms.size === 0) {
      return;
    }

    const roomIds = Array.from(currentState.subscribedRooms);

    const fiber = yield* Effect.scoped(
      Effect.gen(function* () {
        const eventStream = yield* bus.subscribeToRooms(roomIds);
        return yield* Stream.runForEach(eventStream, (event: RoomEvent) =>
          sendMessage(ws, {
            type: "event",
            event,
          }),
        );
      }),
    ).pipe(Effect.fork);

    yield* Ref.update(state, (s) => ({
      ...s,
      streamFiber: fiber,
    }));

    yield* Console.log(`Event stream started for rooms: ${roomIds.join(", ")}`);
  });

const stopEventStream = (state: Ref.Ref<ConnectionState>) =>
  Effect.gen(function* () {
    const currentState = yield* Ref.get(state);

    const fiber = currentState.streamFiber;
    if (fiber) {
      yield* Fiber.interrupt(fiber);
      yield* Ref.update(state, (s) => ({
        ...s,
        streamFiber: null,
      }));
      yield* Console.log("Event stream stopped");
    }
  });

const handleSubscribe = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  roomId: string,
) =>
  Effect.gen(function* () {
    const currentState = yield* Ref.get(state);

    if (!currentState.authenticated || !currentState.userId) {
      yield* sendError(ws, "NOT_AUTHENTICATED", "Please authenticate first");
      return;
    }

    const roomService = yield* RoomService;

    const isMember = yield* roomService
      .isMember(roomId, currentState.userId)
      .pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* sendError(
              ws,
              "ROOM_ACCESS_DENIED",
              "Cannot access this room",
            );
            return yield* Effect.fail(error);
          }),
        ),
      );

    if (!isMember) {
      yield* sendError(
        ws,
        "NOT_ROOM_MEMBER",
        "You are not a member of this room",
      );
      return;
    }

    yield* stopEventStream(state);

    yield* Ref.update(state, (s) => ({
      ...s,
      subscribedRooms: new Set([...s.subscribedRooms, roomId]),
    }));

    yield* startEventStream(ws, state);

    yield* sendMessage(ws, {
      type: "subscribed",
      roomId,
    });

    yield* Console.log(`Subscribed to room: ${roomId}`);
  });

const handleUnsubscribe = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  roomId: string,
) =>
  Effect.gen(function* () {
    const currentState = yield* Ref.get(state);

    if (!currentState.subscribedRooms.has(roomId)) {
      return;
    }

    // stop the running stream before changing subscriptions
    yield* stopEventStream(state);

    // remove the room from subscribedRooms
    yield* Ref.update(state, (s) => {
      const newRooms = new Set(s.subscribedRooms);
      newRooms.delete(roomId);
      return {
        ...s,
        subscribedRooms: newRooms,
      };
    });

    // read updated state and, if there are still rooms, restart the stream
    const updatedState = yield* Ref.get(state);
    if (updatedState.subscribedRooms.size > 0) {
      yield* startEventStream(ws, state);
    }

    yield* sendMessage(ws, {
      type: "unsubscribed",
      roomId,
    });

    yield* Console.log(`Unsubscribed from room: ${roomId}`);
  });

const handleMessageSend = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  roomId: string,
  content: string,
) =>
  Effect.gen(function* () {
    const currentState = yield* Ref.get(state);

    if (!currentState.authenticated || !currentState.userId) {
      yield* sendError(ws, "NOT_AUTHENTICATED", "Please authenticate first");
      return;
    }

    const messageService = yield* MessageService;
    const userService = yield* UserService;
    const bus = yield* RealTimeBus;

    // create the message in DB (or service)
    const message = yield* messageService
      .create(currentState.userId, roomId, content)
      .pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* sendError(
              ws,
              "MESSAGE_SEND_FAILED",
              "Failed to send message",
            );
            // log the error for debugging
            yield* Console.error("messageService.create error:", error);
            return yield* Effect.fail(error);
          }),
        ),
      );

    // publish the new message to RealTimeBus so subscribers get it
    // (this is the crucial missing line from the original)
    const user = yield* userService.findById(currentState.userId);

    const enrichedMessage = {
      ...message,
      username: user.username,
      user_email: user.email ?? null,
      is_edited: false,
    };
    yield* bus
      .publish({
        type: "message.created",
        roomId,
        message: enrichedMessage,
        timestamp: new Date(),
      })
      .pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Console.error(
              "Failed to publish message to RealTimeBus:",
              error,
            );
            return yield* Effect.void;
          }),
        ),
      );

    yield* Console.log(`Published message.created event for room ${roomId}`);
  });

const handleTyping = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  roomId: string,
  isTyping: boolean,
) =>
  Effect.gen(function* () {
    const currentState = yield* Ref.get(state);

    if (
      !currentState.authenticated ||
      !currentState.userId ||
      !currentState.username
    ) {
      return;
    }

    const bus = yield* RealTimeBus;

    yield* bus.publish({
      type: "user.typing",
      roomId,
      userId: currentState.userId,
      username: currentState.username,
      isTyping,
      timestamp: new Date(),
    });
  });

const handleClientMessage = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  data: string,
) =>
  Effect.gen(function* () {
    const parsed = yield* Effect.try(() => JSON.parse(data)).pipe(
      Effect.catchAll(() =>
        Effect.gen(function* () {
          yield* sendError(ws, "INVALID_JSON", "Invalid JSON format");
          return yield* Effect.fail(new Error("Invalid JSON"));
        }),
      ),
    );

    const message = yield* Schema.decodeUnknown(WSClientMessageSchema)(
      parsed,
    ).pipe(
      Effect.catchAll(() =>
        Effect.gen(function* () {
          yield* sendError(ws, "INVALID_MESSAGE", "Invalid message format");
          return yield* Effect.fail(new Error("Invalid message schema"));
        }),
      ),
    );

    switch (message.type) {
      case "auth":
        yield* handleAuthentication(ws, state, message.token);
        break;

      case "subscribe":
        yield* handleSubscribe(ws, state, message.roomId);
        break;

      case "unsubscribe":
        yield* handleUnsubscribe(ws, state, message.roomId);
        break;

      case "message.send":
        yield* handleMessageSend(ws, state, message.roomId, message.content);
        break;

      case "typing":
        yield* handleTyping(ws, state, message.roomId, message.isTyping);
        break;

      case "ping":
        yield* sendMessage(ws, { type: "pong" });
        break;

      default:
        yield* sendError(ws, "UNKNOWN_MESSAGE_TYPE", "Unknown message type");
    }
  }).pipe(
    Effect.catchAll((error) =>
      Console.error("Error handling client message:", error),
    ),
  );

const handleConnection = (
  ws: WebSocket,
  runtime: Runtime.Runtime<
    JwtService | UserService | RoomService | MessageService | RealTimeBus
  >,
) =>
  Effect.gen(function* () {
    const state = yield* Ref.make(createInitialState());

    ws.on("message", (data: Buffer) => {
      const program = handleClientMessage(ws, state, data.toString());
      Effect.runFork(program.pipe(Effect.provide(runtime)));
    });

    ws.on("close", () => {
      const cleanup = Effect.gen(function* () {
        yield* stopEventStream(state);
        const finalState = yield* Ref.get(state);
        yield* Console.log(
          `WebSocket closed: ${finalState.username || "unauthenticated"}`,
        );
      });

      Effect.runFork(cleanup.pipe(Effect.provide(runtime)));
    });

    ws.on("error", (error) => {
      const errorHandler = Console.error(`WebSocket error: ${String(error)}`);
      Effect.runFork(errorHandler.pipe(Effect.provide(runtime)));
    });

    yield* Console.log("New WebSocket connection established");
  });

export const createWebSocketServer = (
  server: any,
): Effect.Effect<
  WSServer,
  never,
  JwtService | UserService | RoomService | MessageService | RealTimeBus
> =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<
      JwtService | UserService | RoomService | MessageService | RealTimeBus
    >();

    const wss = new WSServer({ server, path: "/ws" });

    wss.on("connection", (ws: WebSocket) => {
      console.log("[WebSocketServer] New connection established");
      const program = handleConnection(ws, runtime);
      Effect.runFork(program.pipe(Effect.provide(runtime)));
    });

    yield* Console.log("WebSocket server initialized on path /ws");

    return wss;
  });
