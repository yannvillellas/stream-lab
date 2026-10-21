# Stream Lab

A WebRTC lab for streaming a live camera feed to a supervision dashboard.

The source is a browser or phone camera. The glasses SDK is not integrated: the point is to
understand the transport before touching vendor hardware, and to see where it breaks.

- A camera feed in a browser, with less than a second of latency.
- Live latency, bitrate and packet-loss readings.
- A relay for networks that refuse a direct connection.
- One source and several viewers, without the source uploading a copy to each.

## Getting started

The first runnable version is in progress. It will start with two commands:

```sh
npm install
npm run dev
```

Then open the sender page on a phone and the dashboard on a laptop.

## How it works

A phone or browser captures the camera. A small signalling server introduces it to the dashboard;
the video then travels directly between the two. When a direct path is impossible, a relay forwards
the stream. For several viewers, a media server receives one copy and redistributes it.

The code is TypeScript: a Node.js signalling server and a React dashboard, with WebRTC for the
media path and LiveKit for the media-server comparison.

## Status

Early. The signalling server and the dashboard are the next milestone. The glasses SDK, native
apps, accounts and recording are not part of this lab.
