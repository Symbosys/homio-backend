import http from "node:http";
import app from "./app.js";
import { ENV } from "./config/env.js";
import { wsService } from "./lib/websocket/ws.service.js";

const server = http.createServer(app);

// Initialize Omnichannel Real-Time WebSocket Server
wsService.init(server);

server.listen(ENV.PORT, () => {
  console.log(`Server started on port http://localhost:${ENV.PORT}`);
  console.log(`WebSocket endpoint active on ws://localhost:${ENV.PORT}/ws`);
});