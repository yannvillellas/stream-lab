import type { ConnectionStats } from "./stats";

interface ConnectionStatsPanelProps {
  stats: ConnectionStats | null;
}

export function ConnectionStatsPanel({ stats }: ConnectionStatsPanelProps) {
  return (
    <dl className="stats">
      <Stat label="RTT" value={formatMs(stats?.roundTripTimeMs ?? null)} />
      <Stat label="In" value={formatBitrate(stats?.inboundBitrateKbps ?? null)} />
      <Stat label="Out" value={formatBitrate(stats?.outboundBitrateKbps ?? null)} />
      <Stat label="Loss" value={formatPercent(stats?.packetLossPercent ?? null)} />
      <Stat label="Jitter" value={formatMs(stats?.jitterMs ?? null)} />
      <Stat label="FPS" value={formatNumber(stats?.framesPerSecond ?? null)} />
      <Stat label="Size" value={formatResolution(stats?.width ?? null, stats?.height ?? null)} />
    </dl>
  );
}

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatMs(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)} ms`;
}

function formatBitrate(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return value >= 1000 ? `${(value / 1000).toFixed(1)} Mbps` : `${Math.round(value)} kbps`;
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}`;
}

function formatResolution(width: number | null, height: number | null): string {
  return width === null || height === null ? "—" : `${width}×${height}`;
}
