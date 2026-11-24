import { BufferAttribute, BufferGeometry, Uint16BufferAttribute, type TypedArray } from "three";

/** sRGB byte → linear, 16-bit normalized. */
const SRGB8_TO_LINEAR16 = Uint16Array.from({ length: 256 }, (_, v) => {
  const c = v / 255;
  const lin = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return Math.round(lin * 65535);
});

/**
 * Display geometry for a loaded PLY: shares the position buffer and replaces
 * colors with 16-bit linear values decoded from the raw sRGB bytes.
 *
 * PLYLoader converts 8-bit sRGB to linear and stores the result back in 8 bits,
 * which leaves very few levels in dark tones (linear 1/255 ≈ sRGB 13/255) and
 * shows as banding. Load with the custom mapping `{ srgb: ["red", "green",
 * "blue"] }` so the raw bytes are available as the "srgb" attribute.
 *
 * With `measuredOnly`, points whose custom "inferred" attribute is non-zero
 * (hole-filling patches) are dropped; positions are then copied, not shared.
 */
export function makeDisplayGeometry(
  source: BufferGeometry,
  { measuredOnly = false }: { measuredOnly?: boolean } = {},
): BufferGeometry {
  const geometry = new BufferGeometry();
  const position = source.getAttribute("position") as BufferAttribute;
  const srgb = source.getAttribute("srgb");
  const inferred = measuredOnly ? source.getAttribute("inferred") : undefined;

  // Indices of the points to keep, or null to keep all of them.
  let keep: Uint32Array | null = null;
  if (inferred) {
    const flags = inferred.array;
    const idx = new Uint32Array(flags.length);
    let n = 0;
    for (let i = 0; i < flags.length; i++) if (flags[i] === 0) idx[n++] = i;
    keep = idx.slice(0, n);
  }

  geometry.setAttribute("position", keep ? new BufferAttribute(gather(position.array, keep, 3), 3) : position);
  if (srgb && srgb.array instanceof Uint8Array) {
    const raw = keep ? gather(srgb.array, keep, 3) : srgb.array;
    const out = new Uint16Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = SRGB8_TO_LINEAR16[raw[i]];
    geometry.setAttribute("color", new Uint16BufferAttribute(out, 3, true));
  } else if (source.getAttribute("color")) {
    const color = source.getAttribute("color") as BufferAttribute;
    geometry.setAttribute(
      "color",
      keep ? new BufferAttribute(gather(color.array, keep, 3), 3, color.normalized) : color,
    );
  }
  if (keep) {
    geometry.computeBoundingSphere();
  } else {
    if (!source.boundingSphere) source.computeBoundingSphere();
    geometry.boundingSphere = source.boundingSphere!.clone();
  }
  return geometry;
}

/** The items (of `size` components each) at the given indices. */
function gather<T extends TypedArray>(array: T, indices: Uint32Array, size: number): T {
  const out = new (array.constructor as new (length: number) => T)(indices.length * size);
  for (let j = 0; j < indices.length; j++) {
    const src = indices[j] * size;
    for (let k = 0; k < size; k++) out[j * size + k] = array[src + k];
  }
  return out;
}

/** Copies an attribute to Float32 values, de-normalizing integer arrays to 0..1. */
export function attributeToFloat32(attr: BufferAttribute): Float32Array {
  const a = attr.array;
  if (a instanceof Float32Array) return a.slice();
  const out = new Float32Array(a.length);
  const scale = !attr.normalized
    ? 1
    : a instanceof Uint8Array
      ? 1 / 255
      : a instanceof Uint16Array
        ? 1 / 65535
        : a instanceof Uint32Array
          ? 1 / 4294967295
          : 1;
  for (let i = 0; i < a.length; i++) out[i] = a[i] * scale;
  return out;
}
