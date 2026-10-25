import { useEffect, useState } from "react";
import type { ClientMessage, Role, ServerMessage } from "./protocol";
import { signallingUrl } from "./protocol";
import {
  type ConnectionStats,
  computeConnectionStats,
  type StatsSample,
  sampleStats,
} from "./stats";

export type SessionStatus = "starting" | "waiting" | "connecting" | "streaming" | "error";

export interface StreamSession {
  status: SessionStatus;
  error: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  stats: ConnectionStats | null;
}

const initialState: StreamSession = {
  status: "starting",
  error: null,
  localStream: null,
  remoteStream: null,
  stats: null,
};

export function useStreamSession(role: Role, room: string): StreamSession {
  const [session, setSession] = useState<StreamSession>(initialState);

  useEffect(() => {
    let cancelled = false;
    let localStream: MediaStream | null = null;
    let socket: WebSocket | null = null;
    let pendingCandidates: RTCIceCandidateInit[] = [];
    let offerSent = false;
    let previousStats: StatsSample | null = null;
    let statsTimer: ReturnType<typeof setInterval> | null = null;
    let peer: RTCPeerConnection;

    const update = (next: Partial<StreamSession>) => {
      if (!cancelled) {
        setSession((current) => ({ ...current, ...next }));
      }
    };

    const fail = (error: unknown) => {
      update({
        status: "error",
        error: error instanceof Error ? error.message : "The session failed.",
      });
    };

    const send = (message: ClientMessage) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    const createPeer = (): RTCPeerConnection => {
      const nextPeer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pendingCandidates = [];
      offerSent = false;
      previousStats = null;

      if (localStream) {
        for (const track of localStream.getTracks()) {
          nextPeer.addTrack(track, localStream);
        }
      }

      nextPeer.onicecandidate = (event) => {
        if (peer !== nextPeer || cancelled || !event.candidate) {
          return;
        }

        send({ type: "ice-candidate", candidate: event.candidate.toJSON() });
      };

      nextPeer.ontrack = (event) => {
        if (peer !== nextPeer || cancelled) {
          return;
        }

        const [stream] = event.streams;

        if (stream) {
          update({ remoteStream: stream, status: "streaming", error: null });
        }
      };

      nextPeer.onconnectionstatechange = () => {
        if (peer !== nextPeer || cancelled) {
          return;
        }

        if (nextPeer.connectionState === "connected") {
          update({ status: "streaming", error: null });
        }

        if (nextPeer.connectionState === "failed") {
          update({ status: "error", error: "The peer connection failed." });
        }
      };

      return nextPeer;
    };

    peer = createPeer();

    const flushCandidates = async () => {
      while (pendingCandidates.length > 0) {
        const candidate = pendingCandidates.shift();

        if (candidate) {
          await peer.addIceCandidate(candidate);
        }
      }
    };

    const createOffer = async () => {
      if (offerSent) {
        return;
      }

      offerSent = true;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send({ type: "offer", sdp: offer.sdp ?? "" });
    };

    const resetPeer = () => {
      peer.close();
      peer = createPeer();
      update({ status: "waiting", error: null, remoteStream: null, stats: null });
    };

    const pollStats = async () => {
      const currentPeer = peer;

      try {
        const report = await currentPeer.getStats();

        if (cancelled || currentPeer !== peer) {
          return;
        }

        const sample = sampleStats(report);
        const stats = computeConnectionStats(previousStats, sample);
        previousStats = sample;
        update({ stats });
      } catch {
        // getStats can reject while a peer is being replaced; the next tick recovers.
      }
    };

    const handleMessage = async (message: ServerMessage) => {
      switch (message.type) {
        case "joined":
          if (message.peer) {
            update({ status: "connecting" });

            if (role === "sender") {
              await createOffer();
            }
          } else {
            update({ status: "waiting" });
          }
          break;

        case "peer-joined":
          update({ status: "connecting" });

          if (role === "sender") {
            await createOffer();
          }
          break;

        case "offer": {
          update({ status: "connecting" });
          await peer.setRemoteDescription({ type: "offer", sdp: message.sdp });
          await flushCandidates();

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          send({ type: "answer", sdp: answer.sdp ?? "" });
          break;
        }

        case "answer":
          update({ status: "connecting" });
          await peer.setRemoteDescription({ type: "answer", sdp: message.sdp });
          await flushCandidates();
          break;

        case "ice-candidate":
          if (message.candidate) {
            const candidate = message.candidate as RTCIceCandidateInit;

            if (peer.remoteDescription) {
              await peer.addIceCandidate(candidate);
            } else {
              pendingCandidates.push(candidate);
            }
          }
          break;

        case "peer-left":
          resetPeer();
          break;

        case "error":
          update({ status: "error", error: message.message });
          break;
      }
    };

    const start = async () => {
      try {
        if (role === "sender") {
          if (!navigator.mediaDevices) {
            throw new Error("Camera access requires HTTPS or localhost.");
          }

          localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

          if (cancelled) {
            localStream.getTracks().forEach((track) => {
              track.stop();
            });
            return;
          }

          update({ localStream });

          for (const track of localStream.getTracks()) {
            peer.addTrack(track, localStream);
          }
        }

        if (cancelled) {
          return;
        }

        socket = new WebSocket(signallingUrl());

        socket.onopen = () => {
          if (!cancelled) {
            send({ type: "join", room, role });
          }
        };

        socket.onmessage = (event) => {
          try {
            // The server is the only producer here, so the shape is known.
            const message = JSON.parse(event.data) as ServerMessage;
            void handleMessage(message).catch(fail);
          } catch (error) {
            fail(error);
          }
        };

        socket.onerror = () => {
          update({ status: "error", error: "Cannot reach the signalling server." });
        };

        socket.onclose = () => {
          if (!cancelled) {
            update({ status: "error", error: "The signalling connection closed." });
          }
        };
      } catch (error) {
        fail(error);
      }
    };

    void start();

    statsTimer = setInterval(() => {
      void pollStats();
    }, 1000);
    void pollStats();

    return () => {
      cancelled = true;

      if (statsTimer !== null) {
        clearInterval(statsTimer);
      }

      send({ type: "leave" });
      socket?.close();
      peer.close();
      localStream?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, [role, room]);

  return session;
}
