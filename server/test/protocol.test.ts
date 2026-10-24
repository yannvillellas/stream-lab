import { describe, expect, it } from "vitest";
import { parseClientMessage } from "../src/protocol.js";

describe("parseClientMessage", () => {
  it("parses a join message and trims the room", () => {
    expect(
      parseClientMessage(JSON.stringify({ type: "join", room: "  demo  ", role: "sender" })),
    ).toEqual({
      type: "join",
      room: "demo",
      role: "sender",
    });
  });

  it("parses an offer", () => {
    expect(parseClientMessage(JSON.stringify({ type: "offer", sdp: "v=0" }))).toEqual({
      type: "offer",
      sdp: "v=0",
    });
  });

  it("parses an ICE candidate", () => {
    expect(
      parseClientMessage(JSON.stringify({ type: "ice-candidate", candidate: { candidate: "x" } })),
    ).toEqual({
      type: "ice-candidate",
      candidate: { candidate: "x" },
    });
  });

  it("rejects invalid JSON", () => {
    expect(parseClientMessage("{")).toBeNull();
  });

  it("rejects an unknown role", () => {
    expect(
      parseClientMessage(JSON.stringify({ type: "join", room: "demo", role: "operator" })),
    ).toBeNull();
  });

  it("rejects an empty room", () => {
    expect(
      parseClientMessage(JSON.stringify({ type: "join", room: "   ", role: "sender" })),
    ).toBeNull();
  });

  it("rejects an empty offer", () => {
    expect(parseClientMessage(JSON.stringify({ type: "offer", sdp: "" }))).toBeNull();
  });

  it("rejects an unknown message type", () => {
    expect(parseClientMessage(JSON.stringify({ type: "watch" }))).toBeNull();
  });
});
