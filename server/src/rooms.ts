import type { PeerInfo, Role } from "./protocol.js";

interface Room {
  sender?: string;
  viewer?: string;
}

interface Member {
  room: string;
  role: Role;
  sessionId: string;
}

export type JoinError = "already-in-room" | "role-taken";

export interface JoinResult {
  peer: PeerInfo | null;
  replacedPeerId?: string;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly members = new Map<string, Member>();
  private readonly sessions = new Map<string, string>();

  join(id: string, room: string, role: Role, sessionId: string): JoinResult | { error: JoinError } {
    if (this.members.has(id)) {
      return { error: "already-in-room" };
    }

    const existingId = this.sessions.get(sessionId);

    if (existingId !== undefined && existingId !== id) {
      const existing = this.members.get(existingId);

      if (existing) {
        if (existing.room !== room || existing.role !== role) {
          return { error: "already-in-room" };
        }

        this.removeMember(existingId);
        const result = this.joinNew(id, room, role, sessionId);

        if ("error" in result) {
          return result;
        }

        return { ...result, replacedPeerId: existingId };
      }

      this.sessions.delete(sessionId);
    }

    return this.joinNew(id, room, role, sessionId);
  }

  leave(id: string): { room: string; peer: PeerInfo | null } | null {
    const member = this.members.get(id);

    if (!member) {
      return null;
    }

    const room = this.rooms.get(member.room);

    this.removeMember(id);

    if (!room) {
      return { room: member.room, peer: null };
    }

    const otherRole: Role = member.role === "sender" ? "viewer" : "sender";
    const otherId = room[otherRole];

    return {
      room: member.room,
      peer: otherId === undefined ? null : { id: otherId, role: otherRole },
    };
  }

  getPeer(id: string): PeerInfo | null {
    const member = this.members.get(id);

    if (!member) {
      return null;
    }

    const room = this.rooms.get(member.room);

    if (!room) {
      return null;
    }

    const otherRole: Role = member.role === "sender" ? "viewer" : "sender";
    const otherId = room[otherRole];

    return otherId === undefined ? null : { id: otherId, role: otherRole };
  }

  private joinNew(
    id: string,
    room: string,
    role: Role,
    sessionId: string,
  ): JoinResult | { error: JoinError } {
    const current = this.rooms.get(room) ?? {};

    if (current[role] !== undefined) {
      return { error: "role-taken" };
    }

    current[role] = id;
    this.rooms.set(room, current);
    this.members.set(id, { room, role, sessionId });
    this.sessions.set(sessionId, id);

    const otherRole: Role = role === "sender" ? "viewer" : "sender";
    const otherId = current[otherRole];

    return {
      peer: otherId === undefined ? null : { id: otherId, role: otherRole },
    };
  }

  private removeMember(id: string): void {
    const member = this.members.get(id);

    if (!member) {
      return;
    }

    const room = this.rooms.get(member.room);

    this.members.delete(id);

    if (this.sessions.get(member.sessionId) === id) {
      this.sessions.delete(member.sessionId);
    }

    if (!room) {
      return;
    }

    delete room[member.role];

    if (room.sender === undefined && room.viewer === undefined) {
      this.rooms.delete(member.room);
    }
  }
}
