const { WebSocket } = require("ws");

const ws = new WebSocket("ws://localhost:3002/ws");

ws.on("open", function open() {
  console.log("✓ Connected successfully!");
  ws.close();
});

ws.on("message", function message(data) {
  console.log("Received:", data.toString());
});

ws.on("error", function error(err) {
  console.error("✗ Connection error:", err.message);
  process.exit(1);
});

ws.on("close", function close() {
  console.log("Connection closed");
  process.exit(0);
});

setTimeout(() => {
  console.error("✗ Connection timeout");
  process.exit(1);
}, 5000);
