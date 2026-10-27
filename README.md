# Stream Lab

A WebRTC lab for streaming a live camera feed to a supervision dashboard.

The source is a browser or phone camera. The glasses SDK is not integrated: the point is to
understand the transport before touching vendor hardware, and to see where it breaks.

- A camera feed in a browser, with less than a second of latency.
- Live latency, bitrate and packet-loss readings.
- A relay for networks that refuse a direct connection.
- One source and several viewers, without the source uploading a copy to each.

## Getting started

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

Open <http://localhost:5173> in two tabs. In the first, choose **Share camera** and allow the camera.
In the second, choose **Watch stream** with the same room.

The dashboard runs on <http://localhost:5173> and the signalling server on <http://127.0.0.1:8080>.

To watch from a phone on the same network, run `HOST=0.0.0.0 npm run dev` and open the Network URL
printed by Vite. Camera capture requires HTTPS or localhost, so use the laptop as the sender for now.

The checks are `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.

## How it works

A phone or browser captures the camera. A small signalling server introduces it to the dashboard;
the video then travels directly between the two. When a direct path is impossible, a relay forwards
the stream. For several viewers, a media server receives one copy and redistributes it.

The code is TypeScript: a Node.js signalling server and a React dashboard, with WebRTC for the
media path. A media-server comparison with LiveKit will come later.

## Connection quality and recovery

The dashboard shows RTT, inbound/outbound bitrate, packet loss, jitter, FPS and resolution. RTT is
the network round-trip time, not glass-to-glass latency.

With two devices on the same network, turn the viewer's Wi-Fi off for ten seconds. The session
reconnects with backoff, rejoins the room and starts a new offer. A page reload starts a new session
ID; a network reconnect keeps the existing one.

## Status

Early. The signalling server and the sender/viewer dashboard are in place, with live connection
stats, manual rejoin and automatic reconnection. TURN/4G and multi-viewer support are next. The
glasses SDK, native apps, accounts and recording are not part of this lab.
