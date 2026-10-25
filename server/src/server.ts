import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { parseClientMessage, type ServerMessage } from "./protocol.js";
import { RoomRegistry } from "./rooms.js";

export interface StreamLabServer {
  readonly httpServer: ReturnType<typeof createServer>;
  readonly wss: WebSocketServer;
  listen(port: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

export function createStreamLabServer(): StreamLabServer {
  const httpServer = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });

  const wss = new WebSocketServer({ server: httpServer });
  const rooms = new RoomRegistry();
  const sockets = new Map<string, WebSocket>();

  const send = (socket: WebSocket, message: ServerMessage) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const sendError = (socket: WebSocket, code: string, message: string) => {
    send(socket, { type: "error", code, message });
  };

  wss.on("connection", (socket) => {
    const peerId = randomUUID();
    sockets.set(peerId, socket);

    socket.on("message", (raw) => {
      const message = parseClientMessage(raw.toString());

      if (!message) {
        sendError(socket, "invalid-message", "Message must be valid JSON with a known type.");
        return;
      }

      if (message.type === "join") {
        const result = rooms.join(peerId, message.room, message.role, message.sessionId);

        if ("error" in result) {
          sendError(
            socket,
            result.error,
            result.error === "role-taken"
              ? "That role is already taken in this room."
              : "This client is already in a room.",
          );
          return;
        }

        if (result.replacedPeerId) {
          const oldSocket = sockets.get(result.replacedPeerId);

          if (oldSocket) {
            oldSocket.close();
          }

          if (result.peer) {
            const otherSocket = sockets.get(result.peer.id);

            if (otherSocket) {
              send(otherSocket, { type: "peer-left", peerId: result.replacedPeerId });
            }
          }
        }

        send(socket, {
          type: "joined",
          peerId,
          room: message.room,
          role: message.role,
          peer: result.peer,
        });

        if (result.peer) {
          const otherSocket = sockets.get(result.peer.id);

          if (otherSocket) {
            send(otherSocket, {
              type: "peer-joined",
              peer: { id: peerId, role: message.role },
            });
          }
        }

        return;
      }

      if (message.type === "leave") {
        const result = rooms.leave(peerId);

        if (result?.peer) {
          const otherSocket = sockets.get(result.peer.id);

          if (otherSocket) {
            send(otherSocket, { type: "peer-left", peerId });
          }
        }

        return;
      }

      const other = rooms.getPeer(peerId);

      if (!other) {
        sendError(
          socket,
          "no-peer",
          "Join a room with another peer before sending signalling messages.",
        );
        return;
      }

      const otherSocket = sockets.get(other.id);

      if (!otherSocket) {
        sendError(socket, "no-peer", "The other peer is no longer connected.");
        return;
      }

      switch (message.type) {
        case "offer":
          send(otherSocket, { type: "offer", from: peerId, sdp: message.sdp });
          break;
        case "answer":
          send(otherSocket, { type: "answer", from: peerId, sdp: message.sdp });
          break;
        case "ice-candidate":
          send(otherSocket, {
            type: "ice-candidate",
            from: peerId,
            candidate: message.candidate,
          });
          break;
      }
    });

    socket.on("close", () => {
      sockets.delete(peerId);
      const result = rooms.leave(peerId);

      if (result?.peer) {
        const otherSocket = sockets.get(result.peer.id);

        if (otherSocket) {
          send(otherSocket, { type: "peer-left", peerId });
        }
      }
    });
  });

  return {
    httpServer,
    wss,
    listen(port, host = "127.0.0.1") {
      return new Promise((resolve, reject) => {
        const onError = (error: Error) => {
          reject(error);
        };

        httpServer.once("error", onError);
        httpServer.listen(port, host, () => {
          httpServer.off("error", onError);
          const address = httpServer.address();

          if (address && typeof address === "object") {
            resolve(address.port);
            return;
          }

          reject(new Error("Server did not expose a port"));
        });
      });
    },
    close() {
      for (const client of wss.clients) {
        client.terminate();
      }

      return new Promise((resolve, reject) => {
        wss.close((webSocketError) => {
          if (webSocketError) {
            reject(webSocketError);
            return;
          }

          httpServer.close((httpError) => {
            if (httpError) {
              reject(httpError);
              return;
            }

            resolve();
          });
        });
      });
    },
  };
}
