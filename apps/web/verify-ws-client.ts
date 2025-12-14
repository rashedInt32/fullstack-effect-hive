import { Effect, Stream, Console } from "effect";
import { WebSocketClient } from "./lib/realtime/ws";
import { apiClient } from "./lib/api/client";
import { tokenStorage } from "./lib/api/storage";

// Mock token storage for Node environment
if (typeof window === "undefined") {
  let storedToken: string | null = null;
  (global as any).localStorage = {
    getItem: () => storedToken,
    setItem: (_key: string, value: string) => {
      storedToken = value;
    },
    removeItem: () => {
      storedToken = null;
    },
  };
  // We also need to patch tokenStorage directly because it might have already captured the initial window check
  tokenStorage.get = () => storedToken;
  tokenStorage.set = (token: string) => {
    storedToken = token;
  };
  tokenStorage.clear = () => {
    storedToken = null;
  };
}

const run = Effect.gen(function* () {
  console.log("Starting WebSocket Client Verification...");

  // 1. Register/Login to get a token
  const username = `testuser_${Date.now()}`;
  const password = "password123";
  console.log(`Creating test user: ${username}`);

  try {
    yield* apiClient.auth.signup({ username, password });
    console.log("Signup successful, token stored.");
  } catch (error) {
    console.error("Signup failed:", error);
    return;
  }

  const wsClient = new WebSocketClient("ws://localhost:3003/ws");

  // Subscribe to status updates
  yield* Effect.fork(
    Stream.runForEach(wsClient.getStatusStream(), (status) =>
      Console.log(`[Status Update] ${status}`),
    ),
  );

  // Subscribe to events
  yield* Effect.fork(
    Stream.runForEach(wsClient.getEventStream(), (event) =>
      Console.log(`[Event Received] ${JSON.stringify(event)}`),
    ),
  );

  console.log("Connecting...");
  yield* wsClient.connect();

  // Keep alive to verify authentication and heartbeat
  console.log("Waiting for authentication...");
  yield* Effect.sleep("2 seconds");

  // Create a room to chat in
  console.log("Creating a test room...");
  const room = yield* apiClient.rooms.create({
    name: "test-room",
    type: "channel",
    created_by: "test-user-id-placeholder", // The API will likely ignore this and use the token's user ID
    description: "A test room for verification",
  });
  console.log(`Room created: ${room.id}`);

  // Subscribe to the room
  console.log(`Subscribing to room ${room.id}...`);
  yield* wsClient.subscribe(room.id);
  yield* Effect.sleep("1 second");

  // Send a message
  console.log("Sending a test message...");
  yield* wsClient.sendChatMessage(room.id, "Hello from verification script!");

  // Wait to receive the message event
  yield* Effect.sleep("3 seconds");

  console.log("Disconnecting...");
  yield* wsClient.disconnect();
});

Effect.runPromise(run).catch(console.error);
