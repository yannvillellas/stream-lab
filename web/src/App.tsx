import { useState } from "react";
import type { Role } from "./protocol";
import { Session } from "./Session";

interface SessionConfig {
  role: Role;
  room: string;
}

export function App() {
  const [room, setRoom] = useState("demo");
  const [session, setSession] = useState<SessionConfig | null>(null);

  if (session) {
    return <Session role={session.role} room={session.room} onLeave={() => setSession(null)} />;
  }

  const canJoin = room.trim().length > 0;

  return (
    <main className="shell">
      <p className="eyebrow">Stream Lab</p>
      <h1>Watch a camera feed from another device.</h1>
      <p className="lede">
        Open this page on two devices, in the same room. One shares the camera, the other watches.
      </p>

      <div className="join">
        <label htmlFor="room">Room</label>
        <input
          id="room"
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          autoComplete="off"
        />
        <div className="actions">
          <button
            type="button"
            disabled={!canJoin}
            onClick={() => setSession({ role: "sender", room: room.trim() })}
          >
            Share camera
          </button>
          <button
            type="button"
            disabled={!canJoin}
            onClick={() => setSession({ role: "viewer", room: room.trim() })}
          >
            Watch stream
          </button>
        </div>
      </div>
    </main>
  );
}
