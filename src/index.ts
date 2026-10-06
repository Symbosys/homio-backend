import http from "node:http";
import app from "./app.js";
import { ENV } from "./config/env.js";
import { wsService } from "./lib/websocket/ws.service.js";
import { initWorkers, closeAllQueuesAndWorkers } from "./workers/index.js";

const server = http.createServer(app);

// Initialize Omnichannel Real-Time WebSocket Server
wsService.init(server);

// Initialize Background BullMQ Workers
initWorkers();

server.listen(ENV.PORT, () => {
  console.log(`Server started on port http://localhost:${ENV.PORT}`);
  console.log(`WebSocket endpoint active on ws://localhost:${ENV.PORT}/ws`);
});

// Graceful shutdown handling
const handleGracefulShutdown = async (signal: string) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  try {
    await closeAllQueuesAndWorkers();
  } catch (err: any) {
    console.error("[Server] Error during worker cleanup:", err.message);
  }
  server.close(() => {
    console.log("[Server] HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
