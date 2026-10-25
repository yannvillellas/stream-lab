import { describe, expect, it } from "vitest";
import { computeConnectionStats, sampleStats } from "./stats";

type StatsEntry = [string, Record<string, unknown>];

function report(entries: StatsEntry[]): Map<string, Record<string, unknown>> {
  return new Map(entries);
}

const inboundSample = (bytesReceived: number): Map<string, Record<string, unknown>> =>
  report([
    [
      "inbound",
      {
        type: "inbound-rtp",
        kind: "video",
        bytesReceived,
        packetsLost: 2,
        packetsReceived: 998,
        jitter: 0.005,
        framesPerSecond: 30,
        frameWidth: 1280,
        frameHeight: 720,
      },
    ],
    ["transport", { type: "transport", selectedCandidatePairId: "pair-1" }],
    ["pair-1", { type: "candidate-pair", state: "succeeded", currentRoundTripTime: 0.042 }],
  ]);

describe("sampleStats", () => {
  it("reads inbound video stats and the selected candidate pair", () => {
    const sample = sampleStats(inboundSample(125_000), 1000);

    expect(sample).toEqual({
      timestampMs: 1000,
      inboundBytes: 125_000,
      outboundBytes: 0,
      hasInboundVideo: true,
      hasOutboundVideo: false,
      packetsLost: 2,
      packetsReceived: 998,
      fractionLost: null,
      jitterSeconds: 0.005,
      roundTripSeconds: 0.042,
      framesPerSecond: 30,
      width: 1280,
      height: 720,
    });
  });

  it("falls back to remote-inbound stats for the sender", () => {
    const sample = sampleStats(
      report([
        [
          "outbound",
          { type: "outbound-rtp", kind: "video", bytesSent: 250_000, framesPerSecond: 30 },
        ],
        [
          "remote",
          {
            type: "remote-inbound-rtp",
            kind: "video",
            fractionLost: 0.01,
            roundTripTime: 0.05,
            jitter: 0.004,
          },
        ],
      ]),
      2000,
    );

    expect(sample.outboundBytes).toBe(250_000);
    expect(sample.hasInboundVideo).toBe(false);
    expect(sample.hasOutboundVideo).toBe(true);
    expect(sample.fractionLost).toBe(0.01);
    expect(sample.roundTripSeconds).toBe(0.05);
    expect(sample.jitterSeconds).toBe(0.004);
    expect(sample.framesPerSecond).toBe(30);
  });
});

describe("computeConnectionStats", () => {
  it("returns no bitrate for the first sample", () => {
    const stats = computeConnectionStats(null, sampleStats(inboundSample(125_000), 1000));

    expect(stats.roundTripTimeMs).toBeCloseTo(42);
    expect(stats.inboundBitrateKbps).toBeNull();
    expect(stats.outboundBitrateKbps).toBeNull();
    expect(stats.packetLossPercent).toBeCloseTo(0.2);
    expect(stats.jitterMs).toBeCloseTo(5);
    expect(stats.framesPerSecond).toBe(30);
    expect(stats.width).toBe(1280);
    expect(stats.height).toBe(720);
  });

  it("computes the bitrate from byte deltas", () => {
    const first = sampleStats(inboundSample(125_000), 1000);
    const second = sampleStats(inboundSample(250_000), 2000);

    expect(computeConnectionStats(first, second).inboundBitrateKbps).toBe(1000);
  });

  it("does not report a bitrate for a direction without video stats", () => {
    const first = sampleStats(
      report([["outbound", { type: "outbound-rtp", kind: "video", bytesSent: 1000 }]]),
      1000,
    );
    const second = sampleStats(
      report([["outbound", { type: "outbound-rtp", kind: "video", bytesSent: 2000 }]]),
      2000,
    );
    const stats = computeConnectionStats(first, second);

    expect(stats.outboundBitrateKbps).toBe(8);
    expect(stats.inboundBitrateKbps).toBeNull();
  });

  it("uses the remote fraction lost when inbound counters are absent", () => {
    const sample = sampleStats(
      report([["remote", { type: "remote-inbound-rtp", kind: "video", fractionLost: 0.01 }]]),
      1000,
    );

    expect(computeConnectionStats(null, sample).packetLossPercent).toBeCloseTo(1);
  });

  it("returns nulls when the report is empty", () => {
    expect(computeConnectionStats(null, sampleStats(new Map(), 1000))).toEqual({
      roundTripTimeMs: null,
      inboundBitrateKbps: null,
      outboundBitrateKbps: null,
      packetLossPercent: null,
      jitterMs: null,
      framesPerSecond: null,
      width: null,
      height: null,
    });
  });
});
