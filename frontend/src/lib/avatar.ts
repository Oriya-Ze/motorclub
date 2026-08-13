/** Deterministic avatar background from user id or name. */
const PALETTE = [
  { bg: "hsl(0 72% 48%)", fg: "#fff" },
  { bg: "hsl(24 85% 48%)", fg: "#fff" },
  { bg: "hsl(38 90% 45%)", fg: "#fff" },
  { bg: "hsl(160 55% 38%)", fg: "#fff" },
  { bg: "hsl(200 70% 42%)", fg: "#fff" },
  { bg: "hsl(260 55% 52%)", fg: "#fff" },
  { bg: "hsl(320 60% 48%)", fg: "#fff" },
  { bg: "hsl(210 15% 42%)", fg: "#fff" },
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function avatarColors(seed: string) {
  return PALETTE[hashString(seed) % PALETTE.length];
}

export function avatarInitial(name?: string | null) {
  return name?.trim()[0]?.toUpperCase() ?? "?";
}
