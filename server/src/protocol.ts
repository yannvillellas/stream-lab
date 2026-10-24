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

const MAX_ROOM_LENGTH = 64;

export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  switch (value.type) {
    case "join": {
      if (typeof value.room !== "string" || typeof value.role !== "string") {
        return null;
      }

      const room = value.room.trim();

      if (room.length === 0 || room.length > MAX_ROOM_LENGTH) {
        return null;
      }

      if (value.role !== "sender" && value.role !== "viewer") {
        return null;
      }

      return { type: "join", room, role: value.role };
    }

    case "offer":
    case "answer": {
      if (typeof value.sdp !== "string" || value.sdp.length === 0) {
        return null;
      }

      return { type: value.type, sdp: value.sdp };
    }

    case "ice-candidate": {
      if (!isRecord(value.candidate)) {
        return null;
      }

      return { type: "ice-candidate", candidate: value.candidate };
    }

    case "leave":
      return { type: "leave" };

    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
