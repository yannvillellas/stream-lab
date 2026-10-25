import { useEffect, useRef } from "react";
import { ConnectionStatsPanel } from "./ConnectionStats";
import type { Role } from "./protocol";
import { type SessionStatus, useStreamSession } from "./useStreamSession";

interface SessionProps {
  role: Role;
  room: string;
  onLeave: () => void;
}

const statusLabels: Record<SessionStatus, string> = {
  starting: "Starting…",
  waiting: "Waiting…",
  connecting: "Connecting…",
  streaming: "Live",
  error: "Something went wrong.",
};

export function Session({ role, room, onLeave }: SessionProps) {
  const { status, error, localStream, remoteStream, stats } = useStreamSession(role, room);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideo.current) {
      localVideo.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const statusLabel =
    status === "waiting"
      ? role === "sender"
        ? "Waiting for a viewer…"
        : "Waiting for the camera…"
      : statusLabels[status];

  return (
    <main className="session">
      <header className="session-header">
        <div>
          <p className="eyebrow">Stream Lab · {role}</p>
          <h1>Room {room}</h1>
        </div>
        <button type="button" className="button-secondary" onClick={onLeave}>
          Leave
        </button>
      </header>

      <div className="stage">
        {role === "sender" ? (
          <video ref={localVideo} className="mirror" autoPlay muted playsInline />
        ) : (
          <>
            {/* biome-ignore lint/a11y/useMediaCaption: this milestone streams video without audio */}
            <video ref={remoteVideo} autoPlay playsInline />
          </>
        )}
        {role === "viewer" && !remoteStream && (
          <p className="stage-placeholder">Waiting for the camera feed…</p>
        )}
      </div>

      <ConnectionStatsPanel stats={stats} />

      <div className="session-footer">
        <span className={`status status-${status}`}>{statusLabel}</span>
        {error && <span className="error">{error}</span>}
      </div>
    </main>
  );
}
