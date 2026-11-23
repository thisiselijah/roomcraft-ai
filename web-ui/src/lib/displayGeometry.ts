import { BufferAttribute, BufferGeometry, Uint16BufferAttribute } from "three";

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
 */
export function makeDisplayGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", source.getAttribute("position"));
  const srgb = source.getAttribute("srgb");
  if (srgb && srgb.array instanceof Uint8Array) {
    const raw = srgb.array;
    const out = new Uint16Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = SRGB8_TO_LINEAR16[raw[i]];
    geometry.setAttribute("color", new Uint16BufferAttribute(out, 3, true));
  } else if (source.getAttribute("color")) {
    geometry.setAttribute("color", source.getAttribute("color"));
  }
  if (!source.boundingSphere) source.computeBoundingSphere();
  geometry.boundingSphere = source.boundingSphere!.clone();
  return geometry;
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
