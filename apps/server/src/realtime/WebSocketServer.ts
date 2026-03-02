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
  userEmail: string | null;
  authenticated: boolean;
  subscribedRooms: Set<string>;
  streamFiber: Fiber.RuntimeFiber<void, never> | null;
  userEventFiber: Fiber.RuntimeFiber<void, never> | null;
}

const createInitialState = (): ConnectionState => ({
  userId: null,
  username: null,
  userEmail: null,
  authenticated: false,
  subscribedRooms: new Set(),
  streamFiber: null,
  userEventFiber: null,
});

type ServerEnv =
  | JwtService
  | UserService
  | RoomService
  | MessageService
  | RealTimeBus;

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
  runtime: Runtime.Runtime<ServerEnv>,
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
      userEmail: user.email ?? null,
      authenticated: true,
    }));

    yield* sendMessage(ws, {
      type: "authenticated",
      userId: user.id,
      username: user.username,
    });

    // Start user event stream to receive user-level events (room.member_added, etc.)
    yield* startUserEventStream(ws, state, runtime);

    yield* Console.log(
      `WebSocket authenticated: ${user.username} (${user.id})`,
    );
  });

// startUserEventStream subscribes to user-level events (like room.member_added)
// This runs independently of room subscriptions
const startUserEventStream = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  runtime: Runtime.Runtime<ServerEnv>,
) =>
  Effect.gen(function* () {
    const bus = yield* RealTimeBus;
    const currentState = yield* Ref.get(state);

    if (!currentState.userId) {
      return;
    }

    // Build the long-running program that subscribes to user events
    const program = Effect.gen(function* () {
      const eventStream = yield* bus.subscribeToUser(currentState.userId!);

      yield* Stream.runForEach(eventStream, (event: RoomEvent) =>
        sendMessage(ws, { type: "event", event }),
      );
    }).pipe(Effect.scoped);

    // Fork using Runtime.runFork
    const fiber = Runtime.runFork(runtime)(program);

    yield* Ref.update(state, (s) => ({
      ...s,
      userEventFiber: fiber,
    }));

    yield* Console.log(`User event stream started for user: ${currentState.userId}`);
  });

const stopUserEventStream = (state: Ref.Ref<ConnectionState>) =>
  Effect.gen(function* () {
    const currentState = yield* Ref.get(state);

    const fiber = currentState.userEventFiber;
    if (fiber) {
      yield* Fiber.interrupt(fiber);
      yield* Ref.update(state, (s) => ({
        ...s,
        userEventFiber: null,
      }));
    }
  });

// startEventStream uses Runtime.runFork to spawn the fiber outside of any
// scoped Effect. The PubSub subscription lives until the fiber is explicitly
// interrupted (via stopEventStream), not until the calling Effect completes.
const startEventStream = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  runtime: Runtime.Runtime<ServerEnv>,
) =>
  Effect.gen(function* () {
    const bus = yield* RealTimeBus;
    const currentState = yield* Ref.get(state);

    if (currentState.subscribedRooms.size === 0) {
      return;
    }

    const roomIds = Array.from(currentState.subscribedRooms);

    // Build the long-running program that subscribes to the bus and relays
    // events to the client. Effect.scoped keeps the PubSub subscription alive
    // for as long as the stream consumer is running. We fork it with
    // Runtime.runFork so it is NOT tied to the caller's scope.
    const program = Effect.gen(function* () {
      const eventStream = yield* bus.subscribeToRooms(roomIds);

      yield* Stream.runForEach(eventStream, (event: RoomEvent) =>
        sendMessage(ws, { type: "event", event }),
      );
    }).pipe(Effect.scoped);

    // Fork using Runtime.runFork — this spawns a top-level fiber whose scope
    // is independent of the current Effect, so the PubSub subscription stays
    // alive until the fiber is interrupted.
    const fiber = Runtime.runFork(runtime)(program);

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
    }
  });

const handleSubscribe = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  roomId: string,
  runtime: Runtime.Runtime<ServerEnv>,
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

    yield* startEventStream(ws, state, runtime);

    yield* sendMessage(ws, {
      type: "subscribed",
      roomId,
    });
  });

const handleUnsubscribe = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  roomId: string,
  runtime: Runtime.Runtime<ServerEnv>,
) =>
  Effect.gen(function* () {
    const currentState = yield* Ref.get(state);

    if (!currentState.subscribedRooms.has(roomId)) {
      return;
    }

    yield* stopEventStream(state);

    yield* Ref.update(state, (s) => {
      const newRooms = new Set(s.subscribedRooms);
      newRooms.delete(roomId);
      return {
        ...s,
        subscribedRooms: newRooms,
      };
    });

    const updatedState = yield* Ref.get(state);
    if (updatedState.subscribedRooms.size > 0) {
      yield* startEventStream(ws, state, runtime);
    }

    yield* sendMessage(ws, {
      type: "unsubscribed",
      roomId,
    });
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
    const bus = yield* RealTimeBus;

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
            return yield* Effect.fail(error);
          }),
        ),
      );

    // Use username and email from the authenticated connection state instead
    // of making an extra userService.findById() DB query on every message.
    const enrichedMessage = {
      ...message,
      username: currentState.username!,
      user_email: currentState.userEmail,
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
  runtime: Runtime.Runtime<ServerEnv>,
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
        yield* handleAuthentication(ws, state, message.token, runtime);
        break;

      case "subscribe":
        yield* handleSubscribe(ws, state, message.roomId, runtime);
        break;

      case "unsubscribe":
        yield* handleUnsubscribe(ws, state, message.roomId, runtime);
        break;

      case "message.send":
        yield* handleMessageSend(
          ws,
          state,
          message.roomId,
          message.content,
        ).pipe(
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* sendError(
                ws,
                "MESSAGE_SEND_FAILED",
                error instanceof Error
                  ? error.message
                  : "Failed to send message",
              );
            }),
          ),
        );
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
      Effect.gen(function* () {
        yield* Console.error("Unhandled WebSocket error:", error);
        yield* sendError(
          ws,
          "INTERNAL_ERROR",
          error instanceof Error ? error.message : "Internal server error",
        );
      }),
    ),
  );

const handleConnection = (ws: WebSocket, runtime: Runtime.Runtime<ServerEnv>) =>
  Effect.gen(function* () {
    const state = yield* Ref.make(createInitialState());

    ws.on("message", (data: Buffer) => {
      const program = handleClientMessage(ws, state, data.toString(), runtime);
      Runtime.runFork(runtime)(program);
    });

    ws.on("close", (code, reason) => {
      const cleanup = Effect.gen(function* () {
        yield* stopEventStream(state);
        yield* stopUserEventStream(state);
        const finalState = yield* Ref.get(state);
        yield* Console.log(
          `WebSocket closed: ${finalState.username || "unauthenticated"} (code: ${code}, reason: ${reason.toString()})`,
        );
      });

      Runtime.runFork(runtime)(cleanup);
    });

    ws.on("error", (error) => {
      Runtime.runFork(runtime)(
        Console.error(`WebSocket error: ${String(error)}`),
      );
    });

    yield* Console.log("New WebSocket connection established");
  });

export const createWebSocketServer = (
  server: any,
): Effect.Effect<WSServer, never, ServerEnv> =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<ServerEnv>();

    const wss = new WSServer({ noServer: true });

    wss.on("connection", (ws: WebSocket, req) => {
      const program = handleConnection(ws, runtime);
      Runtime.runFork(runtime)(program);
    });

    yield* Console.log("WebSocket server initialized on path /ws");

    return wss;
  });
