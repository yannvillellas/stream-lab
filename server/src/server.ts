import { createServer } from "node:http";
import { WebSocketServer } from "ws";

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

  wss.on("connection", (socket) => {
    socket.on("message", (data) => {
      if (data.toString() === "ping") {
        socket.send("pong");
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
