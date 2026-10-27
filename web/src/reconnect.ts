const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 5000;

export function reconnectDelay(attempt: number): number {
  if (attempt <= 0) {
    return 0;
  }

  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
}
