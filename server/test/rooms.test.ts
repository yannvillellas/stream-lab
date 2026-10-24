import { describe, expect, it } from "vitest";
import { RoomRegistry } from "../src/rooms.js";

describe("RoomRegistry", () => {
  it("pairs a sender with a viewer", () => {
    const rooms = new RoomRegistry();

    expect(rooms.join("sender", "demo", "sender")).toEqual({ peer: null });
    expect(rooms.join("viewer", "demo", "viewer")).toEqual({
      peer: { id: "sender", role: "sender" },
    });
    expect(rooms.getPeer("sender")).toEqual({ id: "viewer", role: "viewer" });
    expect(rooms.getPeer("viewer")).toEqual({ id: "sender", role: "sender" });
  });

  it("rejects a second sender in the same room", () => {
    const rooms = new RoomRegistry();
    rooms.join("sender-1", "demo", "sender");

    expect(rooms.join("sender-2", "demo", "sender")).toEqual({ error: "role-taken" });
  });

  it("rejects a client that tries to join twice", () => {
    const rooms = new RoomRegistry();
    rooms.join("sender", "demo", "sender");

    expect(rooms.join("sender", "other", "viewer")).toEqual({ error: "already-in-room" });
  });

  it("reports the remaining peer when one leaves", () => {
    const rooms = new RoomRegistry();
    rooms.join("sender", "demo", "sender");
    rooms.join("viewer", "demo", "viewer");

    expect(rooms.leave("viewer")).toEqual({
      room: "demo",
      peer: { id: "sender", role: "sender" },
    });
    expect(rooms.getPeer("sender")).toBeNull();
  });
});
