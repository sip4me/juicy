// Photo filters as 4×5 color matrices (Skia ColorMatrix: rows R, G, B, A; columns R, G, B, A, offset 0–1).
// The same matrix drives the live preview on the Edit screen and the final export, so what you see is what posts.

export type FilterId = 'none' | 'juicy' | 'golden' | 'fresh' | 'moody' | 'mono';

const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

function saturate(s: number) {
  const r = 0.2126, g = 0.7152, b = 0.0722;
  return [
    r * (1 - s) + s, g * (1 - s), b * (1 - s), 0, 0,
    r * (1 - s), g * (1 - s) + s, b * (1 - s), 0, 0,
    r * (1 - s), g * (1 - s), b * (1 - s) + s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

// Multiply two color matrices (apply b, then a).
function mul(a: number[], b: number[]) {
  const out = new Array(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let v = col === 4 ? a[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += a[row * 5 + k] * b[k * 5 + col];
      out[row * 5 + col] = v;
    }
  }
  return out;
}

function tint(r: number, g: number, b: number, offset = 0) {
  return [r, 0, 0, 0, offset, 0, g, 0, 0, offset, 0, 0, b, 0, offset, 0, 0, 0, 1, 0];
}

export const FILTERS: { id: FilterId; label: string; matrix: number[] }[] = [
  { id: 'none', label: 'Original', matrix: IDENTITY },
  // warm, saturated, a little brighter: makes food look its juiciest
  { id: 'juicy', label: 'Juicy', matrix: mul(tint(1.08, 1.02, 0.94, 0.02), saturate(1.35)) },
  // golden-hour glow
  { id: 'golden', label: 'Golden', matrix: mul(tint(1.12, 1.0, 0.82, 0.03), saturate(1.1)) },
  // crisp and cool for salads, drinks, sushi
  { id: 'fresh', label: 'Fresh', matrix: mul(tint(0.96, 1.04, 1.08, 0.02), saturate(1.2)) },
  // deep shadows for night-time ramen and cocktails
  { id: 'moody', label: 'Moody', matrix: mul(tint(1.05, 0.98, 0.92, -0.06), saturate(0.85)) },
  { id: 'mono', label: 'Mono', matrix: saturate(0) },
];

export const filterById = (id: FilterId) => FILTERS.find((f) => f.id === id)!.matrix;
