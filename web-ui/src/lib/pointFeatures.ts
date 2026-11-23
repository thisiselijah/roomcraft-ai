/**
 * Per-point local spacing and surface normals for splat rendering.
 *
 * For every point, its k nearest neighbors give:
 *  - spacing dᵢ = r₈ · √(π/8)   (8th-neighbor distance on a surface of
 *    density ρ is ≈ √(8/(πρ)), and spacing is 1/√ρ), clamped to
 *    [0.5, 2.5] × median so isolated points don't become large blobs
 *  - normal nᵢ = eigenvector of the neighborhood covariance with the smallest
 *    eigenvalue (PCA). Left as (0, 0, 0) where the neighborhood isn't planar
 *    (edges, corners, thin structures, noise); the renderer then uses a
 *    camera-facing disc. Normals are unoriented (sign is arbitrary), which is
 *    fine for two-sided splats.
 *
 *  - coverage radius Rᵢ: when overlapping discs are resolved so the disc whose
 *    center is nearest a pixel wins (paraboloid depth), point i shows exactly
 *    on its Voronoi cell. The smallest hole-free radius is therefore the
 *    distance to the cell's farthest vertex (a circumcenter of an adjacent
 *    Delaunay triangle). The cell is computed in the tangent plane by clipping
 *    a box with the bisector half-planes of the k neighbors. Cells still
 *    touching the box are open (surface boundary): there is no surface beyond,
 *    so their radius is capped at the spacing to avoid fattening silhouettes.
 *
 * Pure function (runs in a worker or Node). ~1.7M points takes a few seconds.
 */

import { buildSpatialHash, kNearest, roughSpacing } from "./spatialHash";

export type PointFeatures = {
  /** Per-point spacing in meters. */
  spacing: Float32Array;
  /** Per-point unit normals (xyz), or zero where unreliable. */
  normals: Float32Array;
  /** Per-point hole-free disc radius in meters (Voronoi coverage). */
  radius: Float32Array;
  medianSpacing: number;
  /** Median coverage radius in meters. */
  medianRadius: number;
  /** Fraction of points that got a normal. */
  planarFraction: number;
};

type Options = {
  /** Neighbors used for PCA. */
  k?: number;
  /** Neighbor rank used for spacing (1-based). */
  spacingRank?: number;
  /** Max surface variation λ₀ / (λ₀+λ₁+λ₂) for a reliable normal. */
  maxVariation?: number;
  /** Min λ₁ / (λ₀+λ₁+λ₂): rejects line-like neighborhoods. */
  minMiddle?: number;
};

export function computePointFeatures(positions: ArrayLike<number>, opts: Options = {}): PointFeatures {
  const { k = 12, spacingRank = 8, maxVariation = 0.12, minMiddle = 0.08 } = opts;
  const n = Math.floor(positions.length / 3);
  const spacing = new Float32Array(n);
  const normals = new Float32Array(3 * n);
  const radius = new Float32Array(n).fill(NaN);
  if (n <= k) return { spacing, normals, radius, medianSpacing: 0, medianRadius: 0, planarFraction: 0 };
  const cell = new VoronoiCell(k);

  // Cell large enough that the k-th neighbor (≈ 2 × spacing on a grid for
  // k = 12) usually lies within the 3×3×3 block.
  const grid = buildSpatialHash(positions, Math.max(roughSpacing(positions) * 2.5, 1e-4));
  const dist2 = new Float64Array(k);
  const idx = new Int32Array(k);
  const rankScale = Math.sqrt(Math.PI / spacingRank);
  let planar = 0;

  for (let i = 0; i < n; i++) {
    const found = kNearest(positions, grid, i, k, dist2, idx);
    spacing[i] = found >= spacingRank ? Math.sqrt(dist2[spacingRank - 1]) * rankScale : NaN;
    if (found < 6) continue;

    // Covariance of the point and its neighbors.
    let mx = positions[3 * i], my = positions[3 * i + 1], mz = positions[3 * i + 2];
    for (let q = 0; q < found; q++) {
      const o = idx[q];
      mx += positions[3 * o]; my += positions[3 * o + 1]; mz += positions[3 * o + 2];
    }
    const m = found + 1;
    mx /= m; my /= m; mz /= m;
    let a00 = 0, a01 = 0, a02 = 0, a11 = 0, a12 = 0, a22 = 0;
    for (let q = -1; q < found; q++) {
      const o = q < 0 ? i : idx[q];
      const x = positions[3 * o] - mx, y = positions[3 * o + 1] - my, z = positions[3 * o + 2] - mz;
      a00 += x * x; a01 += x * y; a02 += x * z; a11 += y * y; a12 += y * z; a22 += z * z;
    }
    if (smallestEigenvector(a00, a01, a02, a11, a12, a22, maxVariation, minMiddle, normals, 3 * i)) {
      planar++;
      radius[i] = cell.coverageRadius(positions, i, idx, found, normals, spacing[i]);
    }
  }

  // Median and clamping of spacing; fill gaps (too few neighbors) with it.
  const sorted = Float32Array.from(spacing.filter((v) => Number.isFinite(v))).sort();
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0.01;
  const lo = median * 0.5, hi = median * 2.5;
  for (let i = 0; i < n; i++) {
    const v = spacing[i];
    spacing[i] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : median;
    // No normal (non-planar) → no tangent plane: fall back to the spacing.
    // Otherwise clamp to [0.4, 1.6] × spacing against degenerate cells.
    const r = radius[i];
    radius[i] = Number.isFinite(r) ? Math.min(1.6 * spacing[i], Math.max(0.4 * spacing[i], r)) : spacing[i];
  }

  const sortedRadius = radius.slice().sort();
  return {
    spacing,
    normals,
    radius,
    medianSpacing: median,
    medianRadius: sortedRadius[Math.floor(n / 2)],
    planarFraction: planar / n,
  };
}

/**
 * Smallest-eigenvalue eigenvector of a symmetric 3×3 matrix (analytic,
 * trigonometric method), written to out[o..o+2] if the neighborhood is
 * planar enough. Returns whether a normal was written.
 */
function smallestEigenvector(
  a00: number, a01: number, a02: number, a11: number, a12: number, a22: number,
  maxVariation: number, minMiddle: number,
  out: Float32Array, o: number,
): boolean {
  const trace = a00 + a11 + a22;
  if (!(trace > 0)) return false;
  const p1 = a01 * a01 + a02 * a02 + a12 * a12;
  const q = trace / 3;
  let e0: number, e1: number; // smallest, middle
  if (p1 === 0) {
    const d = [a00, a11, a22].sort((x, y) => x - y);
    e0 = d[0]; e1 = d[1];
  } else {
    const b00 = a00 - q, b11 = a11 - q, b22 = a22 - q;
    const p = Math.sqrt((b00 * b00 + b11 * b11 + b22 * b22 + 2 * p1) / 6);
    const det =
      b00 * (b11 * b22 - a12 * a12) - a01 * (a01 * b22 - a12 * a02) + a02 * (a01 * a12 - b11 * a02);
    const r = Math.min(1, Math.max(-1, det / (2 * p * p * p)));
    const phi = Math.acos(r) / 3;
    const eMax = q + 2 * p * Math.cos(phi);
    e0 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
    e1 = 3 * q - eMax - e0;
  }
  if (e0 / trace > maxVariation || e1 / trace < minMiddle) return false;

  // Eigenvector: the largest cross product of two rows of (A − e0·I).
  const r0x = a00 - e0, r0y = a01, r0z = a02;
  const r1x = a01, r1y = a11 - e0, r1z = a12;
  const r2x = a02, r2y = a12, r2z = a22 - e0;
  let bx = 0, by = 0, bz = 0, best = 0;
  const consider = (x: number, y: number, z: number) => {
    const l = x * x + y * y + z * z;
    if (l > best) { best = l; bx = x; by = y; bz = z; }
  };
  consider(r0y * r1z - r0z * r1y, r0z * r1x - r0x * r1z, r0x * r1y - r0y * r1x);
  consider(r0y * r2z - r0z * r2y, r0z * r2x - r0x * r2z, r0x * r2y - r0y * r2x);
  consider(r1y * r2z - r1z * r2y, r1z * r2x - r1x * r2z, r1x * r2y - r1y * r2x);
  if (!(best > 0)) return false;
  const inv = 1 / Math.sqrt(best);
  out[o] = bx * inv; out[o + 1] = by * inv; out[o + 2] = bz * inv;
  return true;
}

/**
 * Voronoi cell of a point among its neighbors, in the tangent plane, by
 * clipping a box with each bisector half-plane x·p ≤ |p|²/2 (Sutherland–Hodgman).
 */
class VoronoiCell {
  private xs: Float64Array;
  private ys: Float64Array;
  private nx: Float64Array;
  private ny: Float64Array;

  constructor(k: number) {
    const cap = 4 + 2 * k;
    this.xs = new Float64Array(cap); this.ys = new Float64Array(cap);
    this.nx = new Float64Array(cap); this.ny = new Float64Array(cap);
  }

  /** Farthest Voronoi vertex distance; open cells are capped at `spacing`. */
  coverageRadius(
    positions: ArrayLike<number>, i: number, idx: Int32Array, found: number,
    normals: Float32Array, spacing: number,
  ): number {
    const nx = normals[3 * i], ny = normals[3 * i + 1], nz = normals[3 * i + 2];
    // Tangent basis (u, v) ⟂ n.
    let ux: number, uy: number, uz: number;
    if (Math.abs(nx) < 0.9) { ux = 0; uy = -nz; uz = ny; } else { ux = -nz; uy = 0; uz = nx; }
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;

    const box = 2.5 * (Number.isFinite(spacing) ? spacing : 0.01);
    let { xs, ys, nx: ox, ny: oy } = this;
    let count = 4;
    xs[0] = -box; ys[0] = -box; xs[1] = box; ys[1] = -box; xs[2] = box; ys[2] = box; xs[3] = -box; ys[3] = box;

    const px = positions[3 * i], py = positions[3 * i + 1], pz = positions[3 * i + 2];
    for (let q = 0; q < found && count > 0; q++) {
      const o = idx[q];
      const dx = positions[3 * o] - px, dy = positions[3 * o + 1] - py, dz = positions[3 * o + 2] - pz;
      const a = dx * ux + dy * uy + dz * uz;
      const b = dx * vx + dy * vy + dz * vz;
      const c = (a * a + b * b) / 2;
      if (c < 1e-12) continue; // duplicate point
      // Clip polygon by a·x + b·y ≤ c.
      let m = 0;
      for (let e = 0; e < count; e++) {
        const f = (e + 1) % count;
        const se = a * xs[e] + b * ys[e] - c;
        const sf = a * xs[f] + b * ys[f] - c;
        if (se <= 0) { ox[m] = xs[e]; oy[m] = ys[e]; m++; }
        if ((se <= 0) !== (sf <= 0)) {
          const t = se / (se - sf);
          ox[m] = xs[e] + t * (xs[f] - xs[e]);
          oy[m] = ys[e] + t * (ys[f] - ys[e]);
          m++;
        }
      }
      [xs, ox] = [ox, xs]; [ys, oy] = [oy, ys];
      count = m;
    }
    this.xs = xs; this.ys = ys; this.nx = ox; this.ny = oy;

    let rClosed = 0, open = false;
    for (let e = 0; e < count; e++) {
      const r = Math.hypot(xs[e], ys[e]);
      // A vertex on the box boundary means the cell is unbounded there.
      // (Points on box edges are interpolated between equal ±box coordinates,
      // so they lie on it to rounding precision.)
      if (Math.max(Math.abs(xs[e]), Math.abs(ys[e])) > box * (1 - 1e-6)) open = true;
      else if (r > rClosed) rClosed = r;
    }
    return open ? Math.min(Math.max(rClosed, 0.6 * spacing), spacing) : rClosed;
  }
}
