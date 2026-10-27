export interface StatsSample {
  timestampMs: number;
  inboundBytes: number;
  outboundBytes: number;
  hasInboundVideo: boolean;
  hasOutboundVideo: boolean;
  packetsLost: number | null;
  packetsReceived: number | null;
  fractionLost: number | null;
  jitterSeconds: number | null;
  roundTripSeconds: number | null;
  framesPerSecond: number | null;
  width: number | null;
  height: number | null;
}

export interface ConnectionStats {
  roundTripTimeMs: number | null;
  inboundBitrateKbps: number | null;
  outboundBitrateKbps: number | null;
  packetLossPercent: number | null;
  jitterMs: number | null;
  framesPerSecond: number | null;
  width: number | null;
  height: number | null;
}

export function sampleStats(
  report: Iterable<[string, unknown]>,
  timestampMs = performance.now(),
): StatsSample {
  let inboundBytes = 0;
  let outboundBytes = 0;
  let hasInboundVideo = false;
  let hasOutboundVideo = false;
  let packetsLost: number | null = null;
  let packetsReceived: number | null = null;
  let fractionLost: number | null = null;
  let jitterSeconds: number | null = null;
  let roundTripSeconds: number | null = null;
  let framesPerSecond: number | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let selectedPairId: string | null = null;

  const candidatePairs = new Map<string, Record<string, unknown>>();

  for (const [id, value] of report) {
    if (!isRecord(value)) {
      continue;
    }

    if (value.type === "transport" && typeof value.selectedCandidatePairId === "string") {
      selectedPairId = value.selectedCandidatePairId;
    }

    if (value.type === "candidate-pair") {
      candidatePairs.set(id, value);
    }

    if (value.type === "inbound-rtp" && value.kind === "video") {
      hasInboundVideo = true;
      inboundBytes = number(value.bytesReceived) ?? inboundBytes;
      packetsLost = number(value.packetsLost) ?? packetsLost;
      packetsReceived = number(value.packetsReceived) ?? packetsReceived;
      jitterSeconds = number(value.jitter) ?? jitterSeconds;
      framesPerSecond = number(value.framesPerSecond) ?? framesPerSecond;
      width = number(value.frameWidth) ?? width;
      height = number(value.frameHeight) ?? height;
    }

    if (value.type === "outbound-rtp" && value.kind === "video") {
      hasOutboundVideo = true;
      outboundBytes = number(value.bytesSent) ?? outboundBytes;
      framesPerSecond = number(value.framesPerSecond) ?? framesPerSecond;
      width = number(value.frameWidth) ?? width;
      height = number(value.frameHeight) ?? height;
    }

    if (value.type === "remote-inbound-rtp" && value.kind === "video") {
      fractionLost = number(value.fractionLost) ?? fractionLost;
      roundTripSeconds = number(value.roundTripTime) ?? roundTripSeconds;
      jitterSeconds = number(value.jitter) ?? jitterSeconds;
    }
  }

  const selectedPair = selectedPairId ? candidatePairs.get(selectedPairId) : undefined;
  const fallbackPair = [...candidatePairs.values()].find(
    (candidate) => candidate.state === "succeeded",
  );
  const pair = selectedPair ?? fallbackPair;
  const pairRoundTripSeconds = number(pair?.currentRoundTripTime);

  return {
    timestampMs,
    inboundBytes,
    outboundBytes,
    hasInboundVideo,
    hasOutboundVideo,
    packetsLost,
    packetsReceived,
    fractionLost,
    jitterSeconds,
    roundTripSeconds: pairRoundTripSeconds ?? roundTripSeconds,
    framesPerSecond,
    width,
    height,
  };
}

export function computeConnectionStats(
  previous: StatsSample | null,
  current: StatsSample,
): ConnectionStats {
  const elapsedSeconds = previous ? (current.timestampMs - previous.timestampMs) / 1000 : 0;
  const bitrate = (before: number, after: number): number | null => {
    if (!previous || elapsedSeconds <= 0 || after < before) {
      return null;
    }

    return ((after - before) * 8) / elapsedSeconds / 1000;
  };

  let packetLossPercent: number | null = null;

  if (current.fractionLost !== null) {
    packetLossPercent = current.fractionLost * 100;
  } else if (
    current.packetsLost !== null &&
    current.packetsReceived !== null &&
    current.packetsLost + current.packetsReceived > 0
  ) {
    packetLossPercent =
      (current.packetsLost / (current.packetsLost + current.packetsReceived)) * 100;
  }

  return {
    roundTripTimeMs: current.roundTripSeconds === null ? null : current.roundTripSeconds * 1000,
    inboundBitrateKbps: current.hasInboundVideo
      ? bitrate(previous?.inboundBytes ?? 0, current.inboundBytes)
      : null,
    outboundBitrateKbps: current.hasOutboundVideo
      ? bitrate(previous?.outboundBytes ?? 0, current.outboundBytes)
      : null,
    packetLossPercent,
    jitterMs: current.jitterSeconds === null ? null : current.jitterSeconds * 1000,
    framesPerSecond: current.framesPerSecond,
    width: current.width,
    height: current.height,
  };
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
