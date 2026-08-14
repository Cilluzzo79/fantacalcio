export function parseIntero(text: string,
  opts: { min: number; max: number; fallback: number }): number {
  const digits = text.replace(/[^0-9]/g, "");
  if (digits === "") return opts.fallback;
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return opts.fallback;
  return Math.min(opts.max, Math.max(opts.min, n));
}
