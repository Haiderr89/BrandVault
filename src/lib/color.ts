const HEX = /^#[0-9A-Fa-f]{6}$/;

export const isHex = (v: string) => HEX.test(v);

/** Black or white, whichever reads better on the given background. */
export function readableOn(hex: string) {
  if (!HEX.test(hex)) return "#ffffff";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#111111" : "#ffffff";
}
