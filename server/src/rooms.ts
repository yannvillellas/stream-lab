import type { PeerInfo, Role } from "./protocol.js";

interface Room {
  sender?: string;
  viewer?: string;
}

export type JoinError = "already-in-room" | "role-taken";

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly members = new Map<string, { room: string; role: Role }>();

  join(id: string, room: string, role: Role): { peer: PeerInfo | null } | { error: JoinError } {
    if (this.members.has(id)) {
      return { error: "already-in-room" };
    }

    const current = this.rooms.get(room) ?? {};

    if (current[role] !== undefined) {
      return { error: "role-taken" };
    }

    current[role] = id;
    this.rooms.set(room, current);
    this.members.set(id, { room, role });

    const otherRole: Role = role === "sender" ? "viewer" : "sender";
    const otherId = current[otherRole];

    return {
      peer: otherId === undefined ? null : { id: otherId, role: otherRole },
    };
  }

  leave(id: string): { room: string; peer: PeerInfo | null } | null {
    const member = this.members.get(id);

    if (!member) {
      return null;
    }

    const room = this.rooms.get(member.room);

    if (!room) {
      this.members.delete(id);
      return null;
    }

    delete room[member.role];
    this.members.delete(id);

    const otherRole: Role = member.role === "sender" ? "viewer" : "sender";
    const otherId = room[otherRole];

    if (room.sender === undefined && room.viewer === undefined) {
      this.rooms.delete(member.room);
    }

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
}
