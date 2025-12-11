// Quick test to verify WebSocket server is working
const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:3003/ws");

ws.on("open", () => {
  console.log("✓ WebSocket opened");
  console.log("Sending auth message...");
  ws.send(JSON.stringify({ type: "auth", token: "test-token-will-fail" }));
});

ws.on("message", (data) => {
  console.log("✓ Received message:", data.toString());
});

ws.on("error", (error) => {
  console.error("✗ WebSocket error:", error.message);
});

ws.on("close", (code, reason) => {
  console.log(`✓ WebSocket closed: ${code} - ${reason}`);
  process.exit(0);
});

setTimeout(() => {
  console.log("Timeout - closing connection");
  ws.close();
}, 5000);
