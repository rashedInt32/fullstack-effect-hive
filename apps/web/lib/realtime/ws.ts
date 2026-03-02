"use client";

import {
  Effect,
  Stream,
  Queue,
  Deferred,
  Fiber,
  Schedule,
  pipe,
  Data,
  Schema,
  PubSub,
} from "effect";
import type { WSServerMessage, WSClientMessage, RoomEvent } from "@hive/shared";
import { RoomEventSchema } from "@hive/shared";
import { tokenStorage } from "../api/storage";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "authenticated"
  | "error";

export class WebSocketError extends Data.TaggedError("WebSocketError")<{
  readonly message: string;
}> {}

export class AuthenticationError extends Data.TaggedError(
  "AuthenticationError",
)<{
  readonly message: string;
}> {}

interface WebSocketState {
  ws: WebSocket;
  status: ConnectionStatus;
  userId: string | null;
  username: string | null;
  subscribedRooms: Set<string>;
}

export class WebSocketClient {
  private state: WebSocketState | null = null;
  private connectionFiber: Fiber.RuntimeFiber<void, WebSocketError> | null =
    null;
  private eventHub: PubSub.PubSub<RoomEvent>;
  private messageQueue: Queue.Queue<WSClientMessage>;
  private statusQueue: Queue.Queue<ConnectionStatus>;
  private currentStatus: ConnectionStatus = "disconnected";
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(private readonly url: string) {
    this.eventHub = Effect.runSync(PubSub.unbounded<RoomEvent>());
    this.messageQueue = Effect.runSync(Queue.unbounded<WSClientMessage>());
    this.statusQueue = Effect.runSync(Queue.unbounded<ConnectionStatus>());
    Effect.runSync(Queue.offer(this.statusQueue, "disconnected"));
  }

  connect(): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      if (this.connectionFiber) {
        return;
      }

      // Use forkDaemon so the connection fiber is NOT tied to the parent scope.
      // A regular Effect.fork child gets interrupted when the parent completes,
      // which happens immediately since connect() returns right after forking.
      // forkDaemon creates an independent fiber that lives until explicitly
      // interrupted via disconnect().
      this.connectionFiber = yield* Effect.forkDaemon(
        this.createConnection().pipe(Effect.uninterruptible),
      );
    });
  }

  disconnect(): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* () {
      if (this.connectionFiber) {
        yield* Fiber.interrupt(this.connectionFiber);
        this.connectionFiber = null;
      }

      if (this.state?.ws) {
        this.state.ws.close();
        this.state = null;
      }

      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      yield* this.setStatus("disconnected");

      // Reset the singleton so a new connection can be made
      wsClient = null;
    });
  }

  subscribe(roomId: string): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* () {
      if (this.state) {
        this.state.subscribedRooms.add(roomId);
      }
      yield* this.sendMessage({ type: "subscribe", roomId });
    });
  }

  unsubscribe(roomId: string): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* () {
      if (this.state) {
        this.state.subscribedRooms.delete(roomId);
      }
      yield* this.sendMessage({ type: "unsubscribe", roomId });
    });
  }

  sendChatMessage(
    roomId: string,
    content: string,
  ): Effect.Effect<void, never, never> {
    return this.sendMessage({ type: "message.send", roomId, content });
  }

  sendTyping(
    roomId: string,
    isTyping: boolean,
  ): Effect.Effect<void, never, never> {
    return this.sendMessage({ type: "typing", roomId, isTyping });
  }

  getEventStream(): Stream.Stream<RoomEvent, never, never> {
    return Stream.fromPubSub(this.eventHub);
  }

  getStatusStream(): Stream.Stream<ConnectionStatus, never, never> {
    return Stream.fromQueue(this.statusQueue, { shutdown: false });
  }

  getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  isAuthenticated(): boolean {
    return this.currentStatus === "authenticated";
  }

  private setStatus(
    status: ConnectionStatus,
  ): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* () {
      if (this.state) {
        this.state.status = status;
      }
      this.currentStatus = status;
      yield* Queue.offer(this.statusQueue, status);
    });
  }

  private sendMessage(
    message: WSClientMessage,
  ): Effect.Effect<void, never, never> {
    return Queue.offer(this.messageQueue, message).pipe(Effect.asVoid);
  }

  private createConnection(): Effect.Effect<void, WebSocketError, never> {
    return pipe(
      this.connectWithRetry(),
      Effect.retry(
        Schedule.exponential("1 second").pipe(
          Schedule.union(Schedule.spaced("10 seconds")),
        ),
      ),
      Effect.catchAll(() =>
        Effect.gen(this, function* () {
          yield* this.setStatus("error");
        }),
      ),
      Effect.uninterruptible,
    );
  }

  private connectWithRetry(): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      yield* this.setStatus("connecting");

      const ws = yield* this.createWebSocket();

      const authenticated = yield* Deferred.make<void, AuthenticationError>();

      this.state = {
        ws,
        status: "connecting",
        userId: null,
        username: null,
        subscribedRooms: new Set(),
      };

      const messageHandler = this.setupMessageHandler(ws, authenticated);
      const messageSender = this.setupMessageSender(ws);

      yield* Effect.all([messageHandler, messageSender], {
        concurrency: "unbounded",
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(this, function* () {
            yield* this.setStatus("error");
            return yield* Effect.fail(error);
          }),
        ),
      );
    });
  }

  private createWebSocket(): Effect.Effect<WebSocket, WebSocketError, never> {
    return Effect.async<WebSocket, WebSocketError>((resume) => {
      const ws = new WebSocket(this.url);
      let hasCompleted = false;

      const complete = (result: Effect.Effect<WebSocket, WebSocketError>) => {
        if (!hasCompleted) {
          hasCompleted = true;
          resume(result);
        }
      };

      ws.onopen = () => {
        complete(Effect.succeed(ws));
      };

      ws.onerror = () => {
        complete(
          Effect.fail(
            new WebSocketError({ message: "WebSocket connection failed" }),
          ),
        );
      };

      ws.onclose = (event) => {
        if (!hasCompleted) {
          complete(
            Effect.fail(
              new WebSocketError({ message: "WebSocket closed before open" }),
            ),
          );
        }
      };

      setTimeout(() => {
        if (!hasCompleted) {
          complete(
            Effect.fail(
              new WebSocketError({ message: "WebSocket connection timeout" }),
            ),
          );
        }
      }, 10000);
    });
  }

  private setupMessageHandler(
    ws: WebSocket,
    authenticated: Deferred.Deferred<void, AuthenticationError>,
  ): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      ws.onmessage = (event) => {
        Effect.runFork(
          pipe(
            this.handleServerMessage(event.data, authenticated),
            Effect.catchAll(() => Effect.void),
          ),
        );
      };

      // Wait for WebSocket to be open if it's still connecting
      if (ws.readyState === WebSocket.CONNECTING) {
        yield* Effect.async<void, WebSocketError>((resume) => {
          const checkOpen = () => {
            if (ws.readyState === WebSocket.OPEN) {
              resume(Effect.void);
            } else if (
              ws.readyState === WebSocket.CLOSING ||
              ws.readyState === WebSocket.CLOSED
            ) {
              resume(
                Effect.fail(
                  new WebSocketError({
                    message: "WebSocket closed before opening",
                  }),
                ),
              );
            } else {
              setTimeout(checkOpen, 50);
            }
          };
          checkOpen();
        });
      } else if (ws.readyState !== WebSocket.OPEN) {
        yield* Effect.fail(
          new WebSocketError({
            message: `WebSocket not open for authentication (readyState: ${ws.readyState})`,
          }),
        );
      }

      yield* this.setStatus("authenticating");
      yield* this.authenticate(ws);

      yield* pipe(
        Deferred.await(authenticated),
        Effect.mapError(
          (error) => new WebSocketError({ message: error.message }),
        ),
      );

      // Start ping interval for connection health
      this.pingInterval = setInterval(() => {
        if (this.state?.ws.readyState === WebSocket.OPEN) {
          this.state.ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);

      // Wait for WebSocket close/error to signal reconnection
      const closeSignal = yield* Deferred.make<void, WebSocketError>();

      ws.onerror = () => {
        Effect.runFork(
          Deferred.fail(
            closeSignal,
            new WebSocketError({ message: "WebSocket error" }),
          ),
        );
      };

      ws.onclose = (event) => {
        Effect.runFork(
          Deferred.fail(
            closeSignal,
            new WebSocketError({ message: `WebSocket closed: ${event.code}` }),
          ),
        );
      };

      yield* Deferred.await(closeSignal);
    });
  }

  private authenticate(
    ws: WebSocket,
  ): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      const token = tokenStorage.get();

      if (!token) {
        return yield* Effect.fail(
          new WebSocketError({
            message: "No authentication token found - please log in",
          }),
        );
      }

      if (ws.readyState !== WebSocket.OPEN) {
        return yield* Effect.fail(
          new WebSocketError({
            message: `WebSocket not open (readyState: ${ws.readyState})`,
          }),
        );
      }

      try {
        ws.send(JSON.stringify({ type: "auth", token }));
      } catch (error) {
        return yield* Effect.fail(
          new WebSocketError({
            message: `Failed to send auth: ${error instanceof Error ? error.message : "Unknown error"}`,
          }),
        );
      }
    });
  }

  private handleServerMessage(
    data: string,
    authenticated: Deferred.Deferred<void, AuthenticationError>,
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(this, function* () {
      const message = JSON.parse(data) as WSServerMessage;

      switch (message.type) {
        case "authenticated":
          if (this.state) {
            this.state.userId = message.userId;
            this.state.username = message.username;
          }
          yield* this.setStatus("authenticated");
          yield* Deferred.succeed(authenticated, undefined);
          yield* this.resubscribeToRooms();
          break;

        case "event": {
          const decodeResult = yield* Schema.decodeUnknown(RoomEventSchema)(
            message.event,
          ).pipe(
            Effect.catchAll((err) =>
              Effect.fail(
                new Error(`Invalid event format: ${JSON.stringify(err)}`),
              ),
            ),
          );
          yield* PubSub.publish(this.eventHub, decodeResult);
          break;
        }

        case "subscribed":
          break;

        case "unsubscribed":
          break;

        case "error":
          if (message.code === "UNAUTHORIZED") {
            yield* Deferred.fail(
              authenticated,
              new AuthenticationError({ message: message.message }),
            );
          }
          break;
      }
    });
  }

  private setupMessageSender(ws: WebSocket): Effect.Effect<void, never, never> {
    return pipe(
      Stream.fromQueue(this.messageQueue),
      Stream.tap((message) =>
        Effect.sync(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
          }
        }),
      ),
      Stream.runDrain,
    );
  }

  private resubscribeToRooms(): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* () {
      if (!this.state) return;

      for (const roomId of this.state.subscribedRooms) {
        yield* this.sendMessage({ type: "subscribe", roomId });
      }
    });
  }
}

let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3003/ws";
    wsClient = new WebSocketClient(wsUrl);
  }
  return wsClient;
}
