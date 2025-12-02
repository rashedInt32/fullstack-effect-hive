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
  private eventQueue: Queue.Queue<RoomEvent> | null = null;
  private messageQueue: Queue.Queue<WSClientMessage> | null = null;
  private statusQueue: Queue.Queue<ConnectionStatus> | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(private readonly url: string) {}

  connect(): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      console.log("[WebSocketClient.connect] Called");

      if (this.connectionFiber) {
        console.warn("[WebSocketClient.connect] Already connected");
        yield* Effect.logWarning("WebSocket already connected");
        if (this.statusQueue && this.state) {
          yield* Queue.offer(this.statusQueue, this.state.status);
        }
        return;
      }

      console.log("[WebSocketClient.connect] Creating queues");
      const eventQueue = yield* Queue.unbounded<RoomEvent>();
      const messageQueue = yield* Queue.unbounded<WSClientMessage>();
      const statusQueue = yield* Queue.unbounded<ConnectionStatus>();

      this.eventQueue = eventQueue;
      this.messageQueue = messageQueue;
      this.statusQueue = statusQueue;

      console.log("[WebSocketClient.connect] Creating connection effect");
      const connectionEffect = this.createConnection(
        eventQueue,
        messageQueue,
        statusQueue,
      );

      console.log("[WebSocketClient.connect] Forking connection");
      this.connectionFiber = yield* Effect.fork(connectionEffect);
      console.log("[WebSocketClient.connect] Connection forked successfully");
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

      this.eventQueue = null;
      this.messageQueue = null;
      this.statusQueue = null;
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
    console.log("[WebSocketClient] sendChatMessage:", {
      roomId,
      content,
      status: this.state?.status,
    });
    return this.sendMessage({ type: "message.send", roomId, content });
  }

  sendTyping(
    roomId: string,
    isTyping: boolean,
  ): Effect.Effect<void, never, never> {
    return this.sendMessage({ type: "typing", roomId, isTyping });
  }

  getEventStream(): Stream.Stream<RoomEvent, never, never> {
    return this.eventQueue ? Stream.fromQueue(this.eventQueue) : Stream.empty;
  }

  getStatusStream(): Stream.Stream<ConnectionStatus, never, never> {
    return this.statusQueue ? Stream.fromQueue(this.statusQueue) : Stream.empty;
  }

  getStatus(): ConnectionStatus {
    return this.state?.status ?? "disconnected";
  }

  isAuthenticated(): boolean {
    return this.state?.status === "authenticated";
  }

  private sendMessage(
    message: WSClientMessage,
  ): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* () {
      if (!this.messageQueue) {
        console.warn("[WebSocketClient] Message queue not initialized");
        yield* Effect.logWarning("Message queue not initialized");
        return;
      }
      console.log("[WebSocketClient] Queueing message:", message);
      yield* Queue.offer(this.messageQueue, message);
    });
  }

  private createConnection(
    eventQueue: Queue.Queue<RoomEvent>,
    messageQueue: Queue.Queue<WSClientMessage>,
    statusQueue: Queue.Queue<ConnectionStatus>,
  ): Effect.Effect<void, WebSocketError, never> {
    return pipe(
      this.connectWithRetry(eventQueue, messageQueue, statusQueue),
      Effect.retry(
        Schedule.exponential("1 second").pipe(
          Schedule.union(Schedule.spaced("10 seconds")),
        ),
      ),
      Effect.catchAll((error) =>
        Effect.gen(this, function* () {
          console.log(
            "[WebSocketClient] Connection failed, offering error:",
            error.message,
          );
          yield* Queue.offer(statusQueue, "error");
          yield* Effect.logError(
            `WebSocket connection failed: ${error.message}`,
          );
        }),
      ),
    );
  }

  private connectWithRetry(
    eventQueue: Queue.Queue<RoomEvent>,
    messageQueue: Queue.Queue<WSClientMessage>,
    statusQueue: Queue.Queue<ConnectionStatus>,
  ): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      yield* Queue.offer(statusQueue, "connecting");
      console.log("[WebSocketClient] Offered status: connecting");

      const ws = yield* this.createWebSocket();
      const authenticated = yield* Deferred.make<void, AuthenticationError>();

      this.state = {
        ws,
        status: "connecting",
        userId: null,
        username: null,
        subscribedRooms: new Set(),
      };

      const messageHandler = this.setupMessageHandler(
        ws,
        eventQueue,
        statusQueue,
        authenticated,
      );
      const messageSender = this.setupMessageSender(ws, messageQueue);

      yield* Effect.all([messageHandler, messageSender], {
        concurrency: "unbounded",
      });
    });
  }

  private createWebSocket(): Effect.Effect<WebSocket, WebSocketError, never> {
    return Effect.async<WebSocket, WebSocketError>((resume) => {
      try {
        const ws = new WebSocket(this.url);

        ws.onopen = () => {
          console.log("[WebSocketClient] WebSocket opened");
          resume(Effect.succeed(ws));
        };

        ws.onerror = () => {
          console.log("[WebSocketClient] WebSocket error");
          resume(
            Effect.fail(
              new WebSocketError({ message: "WebSocket connection failed" }),
            ),
          );
        };
      } catch (error) {
        resume(
          Effect.fail(
            new WebSocketError({
              message: error instanceof Error ? error.message : "Unknown error",
            }),
          ),
        );
      }
    });
  }

  private setupMessageHandler(
    ws: WebSocket,
    eventQueue: Queue.Queue<RoomEvent>,
    statusQueue: Queue.Queue<ConnectionStatus>,
    authenticated: Deferred.Deferred<void, AuthenticationError>,
  ): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      yield* Queue.offer(statusQueue, "authenticating");
      console.log("[WebSocketClient] Offered status: authenticating");
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

      yield* Effect.async<void, WebSocketError>((resume) => {
        ws.onmessage = (event) => {
          Effect.runFork(
            pipe(
              this.handleServerMessage(
                event.data,
                eventQueue,
                statusQueue,
                authenticated,
              ),
              Effect.catchAll((error) =>
                Effect.logError(
                  `Message handling error: ${error instanceof Error ? error.message : "Unknown error"}`,
                ),
              ),
            ),
          );
        };

        ws.onerror = () => {
          resume(
            Effect.fail(new WebSocketError({ message: "WebSocket error" })),
          );
        };

        ws.onclose = () => {
          resume(
            Effect.fail(new WebSocketError({ message: "WebSocket closed" })),
          );
        };
      });
    });
  }

  private authenticate(
    ws: WebSocket,
  ): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      const token = tokenStorage.get();
      if (!token) {
        return yield* Effect.fail(
          new WebSocketError({ message: "No authentication token found" }),
        );
      }

      ws.send(JSON.stringify({ type: "auth", token }));
    });
  }

  private handleServerMessage(
    data: string,
    eventQueue: Queue.Queue<RoomEvent>,
    statusQueue: Queue.Queue<ConnectionStatus>,
    authenticated: Deferred.Deferred<void, AuthenticationError>,
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(this, function* () {
      const message = JSON.parse(data) as WSServerMessage;

      switch (message.type) {
        case "authenticated":
          if (this.state) {
            this.state.status = "authenticated";
            this.state.userId = message.userId;
            this.state.username = message.username;
          }
          yield* Queue.offer(statusQueue, "authenticated");
          console.log("[WebSocketClient] Offered status: authenticated");
          yield* Deferred.succeed(authenticated, undefined);
          yield* this.resubscribeToRooms();
          break;

        case "event":
          console.log("[WebSocketClient] Received event:", message.event);
          const validatedEvent = yield* Schema.decodeUnknown(RoomEventSchema)(
            message.event,
          ).pipe(
            Effect.catchAll(() =>
              Effect.fail(new Error("Invalid event format")),
            ),
          );
          yield* Queue.offer(eventQueue, validatedEvent);
          break;

        case "subscribed":
          yield* Effect.logDebug(`Subscribed to room: ${message.roomId}`);
          break;

        case "unsubscribed":
          yield* Effect.logDebug(`Unsubscribed from room: ${message.roomId}`);
          break;

        case "error":
          yield* Effect.logError(
            `Server error: ${message.code} - ${message.message}`,
          );
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

  private setupMessageSender(
    ws: WebSocket,
    messageQueue: Queue.Queue<WSClientMessage>,
  ): Effect.Effect<void, never, never> {
    return pipe(
      Stream.fromQueue(messageQueue),
      Stream.tap((message) =>
        Effect.sync(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log("[WebSocketClient] Sending message via WS:", message);
            ws.send(JSON.stringify(message));
          } else {
            console.warn(
              "[WebSocketClient] WebSocket not open, readyState:",
              ws.readyState,
            );
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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
    const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws";
    wsClient = new WebSocketClient(wsUrl);
  }
  return wsClient;
}
