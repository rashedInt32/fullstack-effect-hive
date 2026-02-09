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
  private statusHub: PubSub.PubSub<ConnectionStatus>;
  private currentStatus: ConnectionStatus = "disconnected";
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(private readonly url: string) {
    // Initialize Hubs and Queues in constructor so they are always available
    this.eventHub = Effect.runSync(PubSub.unbounded<RoomEvent>());
    this.messageQueue = Effect.runSync(Queue.unbounded<WSClientMessage>());
    this.statusHub = Effect.runSync(PubSub.unbounded<ConnectionStatus>());
    // Publish initial status
    Effect.runSync(PubSub.publish(this.statusHub, "disconnected"));
  }

  connect(): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      console.log("[WebSocketClient.connect] Called");

      if (this.connectionFiber) {
        console.warn("[WebSocketClient.connect] Already connected");
        yield* Effect.logWarning("WebSocket already connected");
        return;
      }

      console.log("[WebSocketClient.connect] Creating connection effect");
      // Make the connection uninterruptible to prevent React StrictMode from killing it
      const connectionEffect = this.createConnection().pipe(
        Effect.uninterruptible,
      );

      console.log("[WebSocketClient.connect] Forking connection");
      this.connectionFiber = yield* Effect.fork(connectionEffect);
      console.log("[WebSocketClient.connect] Connection forked successfully");

      // Give the fiber a chance to start running
      yield* Effect.sleep("10 millis");
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
    return Effect.gen(this, function* () {
      console.log("[WebSocketClient] sendChatMessage:", {
        roomId,
        content,
        status: this.currentStatus,
      });
      yield* this.sendMessage({ type: "message.send", roomId, content });
    });
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
    // Start with current status, then continue with updates from PubSub
    console.log(
      `[WebSocketClient.getStatusStream] Creating stream with current status: ${this.currentStatus}`,
    );
    const stream = Stream.concat(
      Stream.succeed(this.currentStatus),
      Stream.fromPubSub(this.statusHub),
    );
    return stream;
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
      console.log(`[WebSocketClient.setStatus] Setting status to: ${status}`);
      if (this.state) {
        this.state.status = status;
      }
      this.currentStatus = status;
      yield* PubSub.publish(this.statusHub, status);
      console.log(`[WebSocketClient.setStatus] Status set to: ${status}`);
    });
  }

  private sendMessage(
    message: WSClientMessage,
  ): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* () {
      console.log("[WebSocketClient] Queueing message:", message);
      yield* Queue.offer(this.messageQueue, message);
    });
  }

  private createConnection(): Effect.Effect<void, WebSocketError, never> {
    return pipe(
      this.connectWithRetry(),
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
          yield* this.setStatus("error");
          yield* Effect.logError(
            `WebSocket connection failed: ${error.message}`,
          );
        }),
      ),
      Effect.uninterruptible, // Prevent React StrictMode from interrupting the connection
    );
  }

  private connectWithRetry(): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      console.log("[WebSocketClient.connectWithRetry] START");
      yield* this.setStatus("connecting");
      console.log("[WebSocketClient] Offered status: connecting");

      console.log("[WebSocketClient.connectWithRetry] Creating WebSocket...");
      console.log(
        "[WebSocketClient.connectWithRetry] About to yield* createWebSocket()",
      );
      const ws = yield* this.createWebSocket();
      console.log(
        "[WebSocketClient.connectWithRetry] WebSocket created, readyState:",
        ws.readyState,
      );
      console.log(
        "[WebSocketClient.connectWithRetry] After yield*, ws is:",
        ws ? "defined" : "undefined",
      );

      console.log("[WebSocketClient.connectWithRetry] Creating Deferred...");
      const authenticated = yield* Deferred.make<void, AuthenticationError>();
      console.log("[WebSocketClient.connectWithRetry] Deferred created");

      console.log("[WebSocketClient.connectWithRetry] Setting state...");
      this.state = {
        ws,
        status: "connecting",
        userId: null,
        username: null,
        subscribedRooms: new Set(),
      };
      console.log("[WebSocketClient.connectWithRetry] State set");

      console.log("[WebSocketClient.connectWithRetry] Creating handlers...");
      const messageHandler = this.setupMessageHandler(ws, authenticated);
      const messageSender = this.setupMessageSender(ws);
      console.log("[WebSocketClient.connectWithRetry] Handlers created");

      console.log("[WebSocketClient.connectWithRetry] Running handlers...");
      yield* Effect.all([messageHandler, messageSender], {
        concurrency: "unbounded",
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(this, function* () {
            console.error(
              "[WebSocketClient.connectWithRetry] Handler error:",
              error,
            );
            yield* this.setStatus("error");
            return yield* Effect.fail(error);
          }),
        ),
      );
      console.log(
        "[WebSocketClient.connectWithRetry] Handlers completed (should never reach here)",
      );
    });
  }

  private createWebSocket(): Effect.Effect<WebSocket, WebSocketError, never> {
    return Effect.async<WebSocket, WebSocketError>((resume) => {
      console.log(
        "[WebSocketClient.createWebSocket] Creating WebSocket to:",
        this.url,
      );

      const ws = new WebSocket(this.url);
      let hasCompleted = false;

      const complete = (result: Effect.Effect<WebSocket, WebSocketError>) => {
        if (!hasCompleted) {
          hasCompleted = true;
          resume(result);
        }
      };

      ws.onopen = () => {
        console.log(
          "[WebSocketClient.createWebSocket] WebSocket opened successfully",
        );
        console.log(
          "[WebSocketClient.createWebSocket] Resuming with WebSocket, readyState:",
          ws.readyState,
        );
        complete(Effect.succeed(ws));
      };

      ws.onerror = () => {
        console.log("[WebSocketClient.createWebSocket] WebSocket error");
        complete(
          Effect.fail(
            new WebSocketError({ message: "WebSocket connection failed" }),
          ),
        );
      };

      ws.onclose = (event) => {
        console.log(
          "[WebSocketClient.createWebSocket] WebSocket closed, code:",
          event.code,
          "reason:",
          event.reason,
        );
        if (!hasCompleted) {
          complete(
            Effect.fail(
              new WebSocketError({ message: "WebSocket closed before open" }),
            ),
          );
        }
      };

      // Timeout after 10 seconds
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
      console.log(
        "[WebSocketClient.setupMessageHandler] START, ws.readyState:",
        ws.readyState,
      );

      ws.onmessage = (event) => {
        console.log("[WebSocketClient] Message received:", event.data);
        Effect.runFork(
          pipe(
            this.handleServerMessage(event.data, authenticated),
            Effect.catchAll((error) =>
              Effect.logError(
                `Message handling error: ${error instanceof Error ? error.message : "Unknown error"}`,
              ),
            ),
          ),
        );
      };

      console.log(
        "[WebSocketClient.setupMessageHandler] Message handler set up",
      );

      // Wait for WebSocket to be open if it's still connecting
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log(
          "[WebSocketClient.setupMessageHandler] WebSocket still CONNECTING, waiting...",
        );
        yield* Effect.async<void, WebSocketError>((resume) => {
          const checkOpen = () => {
            if (ws.readyState === WebSocket.OPEN) {
              console.log(
                "[WebSocketClient.setupMessageHandler] WebSocket is now OPEN",
              );
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
        console.log(
          "[WebSocketClient.setupMessageHandler] WebSocket not OPEN, readyState:",
          ws.readyState,
        );
        yield* Effect.fail(
          new WebSocketError({
            message: `WebSocket not open for authentication (readyState: ${ws.readyState})`,
          }),
        );
      }

      console.log(
        "[WebSocketClient.setupMessageHandler] About to set status to authenticating...",
      );
      yield* this.setStatus("authenticating");
      console.log("[WebSocketClient] Offered status: authenticating");
      console.log(
        "[WebSocketClient.setupMessageHandler] About to call authenticate...",
      );
      yield* this.authenticate(ws);
      console.log("[WebSocketClient] Auth message sent");

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

      // Create a deferred to signal when WebSocket closes/errors
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
        console.log(
          "[WebSocketClient] WebSocket closed:",
          event.code,
          event.reason,
        );
        Effect.runFork(
          Deferred.fail(
            closeSignal,
            new WebSocketError({ message: `WebSocket closed: ${event.code}` }),
          ),
        );
      };

      console.log(
        "[WebSocketClient.setupMessageHandler] Waiting for WebSocket close...",
      );
      // This will complete when the WebSocket closes or errors
      yield* Deferred.await(closeSignal);
    });
  }

  private authenticate(
    ws: WebSocket,
  ): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      const token = tokenStorage.get();
      console.log(
        "[WebSocketClient.authenticate] Token from storage:",
        token ? `${token.substring(0, 20)}...` : "null",
      );

      if (!token) {
        console.error(
          "[WebSocketClient.authenticate] ❌ NO TOKEN FOUND IN LOCALSTORAGE!",
        );
        console.error(
          "[WebSocketClient.authenticate] User needs to log in again",
        );
        return yield* Effect.fail(
          new WebSocketError({
            message: "No authentication token found - please log in",
          }),
        );
      }

      console.log(
        "[WebSocketClient.authenticate] Preparing to send auth message",
      );
      console.log(
        "[WebSocketClient.authenticate] ws.readyState:",
        ws.readyState,
        "(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)",
      );

      if (ws.readyState !== WebSocket.OPEN) {
        console.error(
          "[WebSocketClient.authenticate] ❌ WebSocket not in OPEN state! Cannot send auth message",
        );
        return yield* Effect.fail(
          new WebSocketError({
            message: `WebSocket not open (readyState: ${ws.readyState})`,
          }),
        );
      }

      const authMessage = JSON.stringify({ type: "auth", token });
      console.log(
        "[WebSocketClient.authenticate] Sending auth message (length:",
        authMessage.length,
        ")",
      );

      try {
        ws.send(authMessage);
        console.log(
          "[WebSocketClient.authenticate] ✅ Auth message sent successfully!",
        );
      } catch (error) {
        console.error(
          "[WebSocketClient.authenticate] ❌ Failed to send auth message:",
          error,
        );
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
          console.log("[WebSocketClient] Offered status: authenticated");
          yield* Deferred.succeed(authenticated, undefined);
          yield* this.resubscribeToRooms();
          break;

        case "event": {
          console.log("[WebSocketClient] Received event:", message.event);
          const decodeResult = yield* Schema.decodeUnknown(RoomEventSchema)(
            message.event,
          ).pipe(
            Effect.tapError((err) =>
              Effect.sync(() => {
                console.error(
                  "[WebSocketClient] Event validation failed:",
                  err,
                );
                console.error("[WebSocketClient] Event data:", message.event);
              }),
            ),
            Effect.catchAll((err) =>
              Effect.fail(
                new Error(`Invalid event format: ${JSON.stringify(err)}`),
              ),
            ),
          );
          console.log(
            "[WebSocketClient] Publishing validated event:",
            decodeResult,
          );
          yield* PubSub.publish(this.eventHub, decodeResult);
          console.log("[WebSocketClient] Event published successfully");
          break;
        }

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

  private setupMessageSender(ws: WebSocket): Effect.Effect<void, never, never> {
    return pipe(
      Stream.fromQueue(this.messageQueue),
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
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3003/ws";
    wsClient = new WebSocketClient(wsUrl);
  }
  return wsClient;
}
