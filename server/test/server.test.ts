import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createStreamLabServer, type StreamLabServer } from "../src/server.js";

let server: StreamLabServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("signalling server", () => {
  it("serves a health check", async () => {
    server = createStreamLabServer();
    const port = await server.listen(0);

    const response = await fetch(`http://127.0.0.1:${port}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("answers ping with pong", async () => {
    server = createStreamLabServer();
    const port = await server.listen(0);
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);

    await new Promise<void>((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });

    const reply = new Promise<string>((resolve, reject) => {
      socket.once("message", (data) => resolve(data.toString()));
      socket.once("error", reject);
    });

    socket.send("ping");
    await expect(reply).resolves.toBe("pong");

    await new Promise<void>((resolve) => {
      socket.once("close", resolve);
      socket.close();
    });
  });
});
