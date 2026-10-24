import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { ServerMessage } from "../src/protocol.js";
import { createStreamLabServer, type StreamLabServer } from "../src/server.js";

let server: StreamLabServer | undefined;
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const socket of sockets) {
    socket.terminate();
  }

  sockets.length = 0;
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

  it("relays a session between a sender and a viewer", async () => {
    server = createStreamLabServer();
    const port = await server.listen(0);
    const sender = await connect(port);
    const viewer = await connect(port);
    const senderInbox = createInbox(sender);
    const viewerInbox = createInbox(viewer);

    sender.send(JSON.stringify({ type: "join", room: "demo", role: "sender" }));
    const senderJoined = await senderInbox("joined");
    expect(senderJoined).toMatchObject({
      type: "joined",
      room: "demo",
      role: "sender",
      peer: null,
    });

    if (senderJoined.type !== "joined") {
      throw new Error("Expected a joined message");
    }

    viewer.send(JSON.stringify({ type: "join", room: "demo", role: "viewer" }));
    const viewerJoined = await viewerInbox("joined");

    if (viewerJoined.type !== "joined") {
      throw new Error("Expected a joined message");
    }

    expect(viewerJoined).toMatchObject({
      type: "joined",
      room: "demo",
      role: "viewer",
      peer: { id: senderJoined.peerId, role: "sender" },
    });

    const senderPeerJoined = await senderInbox("peer-joined");
    expect(senderPeerJoined).toMatchObject({
      type: "peer-joined",
      peer: { id: viewerJoined.peerId, role: "viewer" },
    });

    sender.send(JSON.stringify({ type: "offer", sdp: "offer-sdp" }));
    const offer = await viewerInbox("offer");
    expect(offer).toMatchObject({
      type: "offer",
      from: senderJoined.peerId,
      sdp: "offer-sdp",
    });

    viewer.send(JSON.stringify({ type: "answer", sdp: "answer-sdp" }));
    const answer = await senderInbox("answer");
    expect(answer).toMatchObject({
      type: "answer",
      from: viewerJoined.peerId,
      sdp: "answer-sdp",
    });

    const candidate = { candidate: "candidate:1" };
    viewer.send(JSON.stringify({ type: "ice-candidate", candidate }));
    const relayedCandidate = await senderInbox("ice-candidate");
    expect(relayedCandidate).toMatchObject({
      type: "ice-candidate",
      from: viewerJoined.peerId,
      candidate,
    });

    viewer.close();
    await new Promise<void>((resolve) => {
      viewer.once("close", resolve);
    });

    const peerLeft = await senderInbox("peer-left");
    expect(peerLeft).toMatchObject({
      type: "peer-left",
      peerId: viewerJoined.peerId,
    });
  });
});

async function connect(port: number): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  sockets.push(socket);

  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  return socket;
}

function createInbox(socket: WebSocket) {
  const queue: ServerMessage[] = [];
  const waiters: Array<{
    type: ServerMessage["type"];
    resolve: (message: ServerMessage) => void;
  }> = [];

  socket.on("message", (data) => {
    // The server is the only producer here, so the shape is known.
    const message = JSON.parse(data.toString()) as ServerMessage;
    const waiterIndex = waiters.findIndex((waiter) => waiter.type === message.type);

    if (waiterIndex === -1) {
      queue.push(message);
      return;
    }

    const [waiter] = waiters.splice(waiterIndex, 1);
    waiter?.resolve(message);
  });

  return (type: ServerMessage["type"]): Promise<ServerMessage> => {
    const messageIndex = queue.findIndex((message) => message.type === type);

    if (messageIndex !== -1) {
      const [message] = queue.splice(messageIndex, 1);

      if (message) {
        return Promise.resolve(message);
      }
    }

    return new Promise((resolve) => {
      waiters.push({ type, resolve });
    });
  };
}
