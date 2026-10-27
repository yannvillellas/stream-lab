import { describe, expect, it } from "vitest";
import { reconnectDelay } from "./reconnect";

describe("reconnectDelay", () => {
  it("returns zero before the first retry", () => {
    expect(reconnectDelay(0)).toBe(0);
  });

  it("backs off exponentially and caps at five seconds", () => {
    expect(reconnectDelay(1)).toBe(500);
    expect(reconnectDelay(2)).toBe(1000);
    expect(reconnectDelay(3)).toBe(2000);
    expect(reconnectDelay(4)).toBe(4000);
    expect(reconnectDelay(5)).toBe(5000);
    expect(reconnectDelay(10)).toBe(5000);
  });
});
