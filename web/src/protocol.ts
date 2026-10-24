// Mirrors server/src/protocol.ts. The two runtimes share the JSON contract, not the code.
export type Role = "sender" | "viewer";

export type ClientMessage =
  | { type: "join"; room: string; role: Role }
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice-candidate"; candidate: unknown }
  | { type: "leave" };

export interface PeerInfo {
  id: string;
  role: Role;
}

export type ServerMessage =
  | {
      type: "joined";
      peerId: string;
      room: string;
      role: Role;
      peer: PeerInfo | null;
    }
  | { type: "peer-joined"; peer: PeerInfo }
  | { type: "peer-left"; peerId: string }
  | { type: "offer"; from: string; sdp: string }
  | { type: "answer"; from: string; sdp: string }
  | { type: "ice-candidate"; from: string; candidate: unknown }
  | { type: "error"; code: string; message: string };

export function signallingUrl(): string {
  const override = import.meta.env.VITE_SIGNALING_URL;

  if (override) {
    return override;
  }

  const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";

  return `${scheme}://${host}:8080`;
}
