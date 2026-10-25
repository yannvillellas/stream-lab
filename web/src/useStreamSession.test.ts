import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStreamSession } from "./useStreamSession";

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(message) }));
  }
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];

  readonly addedTracks: MediaStreamTrack[] = [];
  readonly candidates: RTCIceCandidateInit[] = [];
  closed = false;
  connectionState: RTCPeerConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  constructor(readonly configuration: RTCConfiguration) {
    FakePeerConnection.instances.push(this);
  }

  addTrack(track: MediaStreamTrack) {
    this.addedTracks.push(track);
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: `offer-${FakePeerConnection.instances.length}` };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: "answer" };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description;
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    this.candidates.push(candidate);
  }

  async getStats(): Promise<Map<string, unknown>> {
    return new Map();
  }

  close() {
    this.closed = true;
    this.connectionState = "closed";
  }
}

interface FakeMedia {
  stream: MediaStream;
  stop: ReturnType<typeof vi.fn>;
}

let media: FakeMedia;

beforeEach(() => {
  FakeWebSocket.instances = [];
  FakePeerConnection.instances = [];
  media = createMedia();

  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);

  Object.defineProperty(window.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue(media.stream),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useStreamSession", () => {
  it("creates a new peer and a new offer when the viewer leaves and returns", async () => {
    const { result } = renderHook(() => useStreamSession("sender", "demo"));

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    if (!socket) throw new Error("Expected a WebSocket");

    act(() => socket.open());
    expect(messages(socket)).toContainEqual({ type: "join", room: "demo", role: "sender" });

    act(() => socket.receive({ type: "peer-joined", peer: { id: "viewer-1", role: "viewer" } }));
    await waitFor(() => expect(messages(socket)).toContainEqual({ type: "offer", sdp: "offer-1" }));

    const firstPeer = FakePeerConnection.instances[0];
    if (!firstPeer) throw new Error("Expected the first peer");
    expect(firstPeer.addedTracks).toHaveLength(1);

    act(() => socket.receive({ type: "peer-left", peerId: "viewer-1" }));

    expect(firstPeer.closed).toBe(true);
    expect(FakePeerConnection.instances).toHaveLength(2);
    expect(result.current.status).toBe("waiting");
    expect(result.current.error).toBeNull();
    expect(result.current.remoteStream).toBeNull();

    act(() => socket.receive({ type: "peer-joined", peer: { id: "viewer-2", role: "viewer" } }));
    await waitFor(() => expect(messages(socket)).toContainEqual({ type: "offer", sdp: "offer-2" }));

    const secondPeer = FakePeerConnection.instances[1];
    if (!secondPeer) throw new Error("Expected the second peer");
    expect(secondPeer.addedTracks).toHaveLength(1);
  });

  it("sends leave and stops the camera when the session unmounts", async () => {
    const { unmount } = renderHook(() => useStreamSession("sender", "demo"));

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    if (!socket) throw new Error("Expected a WebSocket");

    act(() => socket.open());
    unmount();

    expect(media.stop).toHaveBeenCalledTimes(1);
    expect(messages(socket)).toContainEqual({ type: "leave" });
    expect(socket.readyState).toBe(3);
  });
});

function createMedia(): FakeMedia {
  const stop = vi.fn();
  // The hook only needs kind, stop and getTracks; a full MediaStream is unnecessary here.
  const track = { kind: "video", stop } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;

  return { stream, stop };
}

function messages(socket: FakeWebSocket): unknown[] {
  return socket.sent.map((message) => JSON.parse(message) as unknown);
}
