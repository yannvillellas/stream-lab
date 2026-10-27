import { describe, expect, it } from "vitest";
import { RoomRegistry } from "../src/rooms.js";

describe("RoomRegistry", () => {
  it("pairs a sender with a viewer", () => {
    const rooms = new RoomRegistry();

    expect(rooms.join("sender", "demo", "sender", "session-sender")).toEqual({ peer: null });
    expect(rooms.join("viewer", "demo", "viewer", "session-viewer")).toEqual({
      peer: { id: "sender", role: "sender" },
    });
    expect(rooms.getPeer("sender")).toEqual({ id: "viewer", role: "viewer" });
    expect(rooms.getPeer("viewer")).toEqual({ id: "sender", role: "sender" });
  });

  it("rejects a second sender in the same room", () => {
    const rooms = new RoomRegistry();
    rooms.join("sender-1", "demo", "sender", "session-1");

    expect(rooms.join("sender-2", "demo", "sender", "session-2")).toEqual({
      error: "role-taken",
    });
  });

  it("rejects a client that tries to join twice", () => {
    const rooms = new RoomRegistry();
    rooms.join("sender", "demo", "sender", "session-1");

    expect(rooms.join("sender", "other", "viewer", "session-2")).toEqual({
      error: "already-in-room",
    });
  });

  it("replaces a peer that reconnects with the same session", () => {
    const rooms = new RoomRegistry();
    rooms.join("sender-1", "demo", "sender", "session-1");
    rooms.join("viewer", "demo", "viewer", "session-2");

    expect(rooms.join("sender-2", "demo", "sender", "session-1")).toEqual({
      peer: { id: "viewer", role: "viewer" },
      replacedPeerId: "sender-1",
    });
    expect(rooms.getPeer("viewer")).toEqual({ id: "sender-2", role: "sender" });
    expect(rooms.getPeer("sender-1")).toBeNull();
  });

  it("reports the remaining peer when one leaves", () => {
    const rooms = new RoomRegistry();
    rooms.join("sender", "demo", "sender", "session-sender");
    rooms.join("viewer", "demo", "viewer", "session-viewer");

    expect(rooms.leave("viewer")).toEqual({
      room: "demo",
      peer: { id: "sender", role: "sender" },
    });
    expect(rooms.getPeer("sender")).toBeNull();
  });
});
