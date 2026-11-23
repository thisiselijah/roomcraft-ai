/**
 * Picks a point size for a point cloud by minimizing a hole-vs-blur loss over
 * the cloud's local point spacing. Used by the Square point shape only (Disc
 * gets per-point Voronoi radii from pointFeatures.ts).
 *
 * 1. Spacing d_i. Sample `samples` points; for each, take the distance r_k to
 *    its k-th nearest neighbor (k = 8) and convert it to spacing:
 *      d_i = r_k · √(π / k)
 *    On a surface of density ρ (points/m²), E[r_k] ≈ √(k / (πρ)) and the
 *    sample spacing is d = 1/√ρ. The k-th neighbor (not the 1st) is used so
 *    near-duplicate points from fused scans don't collapse the estimate.
 *
 * 2. Loss. Each point is a square splat of world width s:
 *      s < d_i  -> gaps between splats (holes), penalty α per unit
 *      s > d_i  -> splats overlap and blur detail, penalty β per unit
 *    Pinball (quantile) loss:
 *      L(s) = Σ_i [ α·max(0, d_i − s) + β·max(0, s − d_i) ]
 *
 * 3. Minimizer. L is convex and piecewise linear. Growing s slightly lowers the
 *    loss by α for the points still above s (fraction 1 − F(s)) and raises it
 *    by β for those already below (fraction F(s)), where F is the CDF of d_i.
 *    The optimum balances the two:
 *      α·(1 − F(s)) = β·F(s)  ->  F(s*) = τ = α / (α + β)
 *    So s* is the τ-quantile of {d_i}: one sort, no iterative fitting.
 *    Defaults α = 3.4, β = 0.8 give τ ≈ 0.81 (about 81% of the surface
 *    renders hole-free), s* ≈ 18 mm on room_fused.ply.
 *
 * 4. To three.js units: size = s* / tan(fov / 2)  (worldSizeToMaterialSize).
 *
 * Pure function with no imports (runs in a worker or Node).
 */

export type PointSizeEstimate = {
  /** World width (meters) each splat should cover: the loss minimizer s*. */
  worldSize: number;
  /** Spacing quantiles (meters) from the sample, for inspection. */
  spacing: { p10: number; p50: number; p90: number };
  sampled: number;
};

type Options = {
  /** Hole penalty α and blur penalty β of the loss. */
  holeWeight?: number;
  blurWeight?: number;
  /** Neighbor rank used for the spacing estimate. */
  k?: number;
  /** Number of query points sampled. */
  samples?: number;
};

export function estimatePointSize(
  positions: ArrayLike<number>,
  opts: Options = {},
): PointSizeEstimate {
  const { holeWeight = 3.4, blurWeight = 0.8, k = 8, samples = 20000 } = opts;
  const n = Math.floor(positions.length / 3);
  if (n < k + 1) return { worldSize: 0.01, spacing: { p10: 0, p50: 0, p90: 0 }, sampled: 0 };

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  for (let i = 0; i < n; i++) {
    if (positions[3 * i] < minX) minX = positions[3 * i];
    if (positions[3 * i + 1] < minY) minY = positions[3 * i + 1];
    if (positions[3 * i + 2] < minZ) minZ = positions[3 * i + 2];
  }

  // Spatial hash: counting sort of point indices by hashed cell.
  const TABLE = 1 << 21;
  const MASK = TABLE - 1;
  const hash = (ix: number, iy: number, iz: number) =>
    (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & MASK;

  const buildGrid = (cell: number) => {
    const keys = new Uint32Array(n);
    const start = new Uint32Array(TABLE + 1);
    for (let i = 0; i < n; i++) {
      const h = hash(
        Math.floor((positions[3 * i] - minX) / cell),
        Math.floor((positions[3 * i + 1] - minY) / cell),
        Math.floor((positions[3 * i + 2] - minZ) / cell),
      );
      keys[i] = h;
      start[h + 1]++;
    }
    for (let h = 0; h < TABLE; h++) start[h + 1] += start[h];
    const fill = start.slice(0, TABLE);
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[fill[keys[i]]++] = i;
    return { start, order };
  };

  // Deterministic sample (LCG) so the result is stable across reloads.
  let seed = 12345;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const m = Math.min(samples, n);
  const queries = new Uint32Array(m);
  for (let j = 0; j < m; j++) queries[j] = Math.floor(rand() * n);

  // Rough spacing first, to size the kNN grid: in a 10 cm voxel holding c
  // surface points, spacing ≈ 0.1 / √c.
  const rough = (() => {
    const cell = 0.1;
    const { start } = buildGrid(cell);
    const est: number[] = [];
    for (let j = 0; j < Math.min(m, 2000); j++) {
      const i = queries[j];
      const h = hash(
        Math.floor((positions[3 * i] - minX) / cell),
        Math.floor((positions[3 * i + 1] - minY) / cell),
        Math.floor((positions[3 * i + 2] - minZ) / cell),
      );
      est.push(cell / Math.sqrt(Math.max(1, start[h + 1] - start[h])));
    }
    est.sort((a, b) => a - b);
    return est[Math.floor(est.length / 2)];
  })();

  // kNN grid: a cell big enough that the k-th neighbor is usually within the
  // 3×3×3 block around the query (r_k ≈ 1.6·d for k = 8).
  const cell = Math.max(rough * 3, 1e-4);
  const { start, order } = buildGrid(cell);
  const best = new Float64Array(k); // k smallest squared distances, ascending
  const spacing = new Float64Array(m);
  const scale = Math.sqrt(Math.PI / k);
  let count = 0;

  for (let j = 0; j < m; j++) {
    const i = queries[j];
    const px = positions[3 * i], py = positions[3 * i + 1], pz = positions[3 * i + 2];
    const cx = Math.floor((px - minX) / cell), cy = Math.floor((py - minY) / cell), cz = Math.floor((pz - minZ) / cell);
    best.fill(Infinity);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const h = hash(cx + dx, cy + dy, cz + dz);
          for (let t = start[h]; t < start[h + 1]; t++) {
            const o = order[t];
            if (o === i) continue;
            const ex = positions[3 * o] - px, ey = positions[3 * o + 1] - py, ez = positions[3 * o + 2] - pz;
            const d2 = ex * ex + ey * ey + ez * ez;
            if (d2 >= best[k - 1]) continue;
            // Insert into the sorted k-best list.
            let p = k - 1;
            while (p > 0 && best[p - 1] > d2) { best[p] = best[p - 1]; p--; }
            best[p] = d2;
          }
        }
    // Hash collisions can only add candidates, and the distance test filters
    // them, so `best` holds the true kNN within the block.
    if (Number.isFinite(best[k - 1])) spacing[count++] = Math.sqrt(best[k - 1]) * scale;
  }

  const d = spacing.subarray(0, count).sort();
  const q = (p: number) => d[Math.min(count - 1, Math.max(0, Math.round(p * (count - 1))))];
  const tau = holeWeight / (holeWeight + blurWeight);

  return {
    worldSize: q(tau),
    spacing: { p10: q(0.1), p50: q(0.5), p90: q(0.9) },
    sampled: count,
  };
}

/**
 * Converts a world width into `PointsMaterial.size` (with sizeAttenuation).
 * three.js draws gl_PointSize = size · (viewportHeight / 2) / depth, while a
 * world length L projects to L · (viewportHeight / 2) / (depth · tan(fov / 2)),
 * so size = L / tan(fov / 2). Pixel ratio cancels out.
 */
export function worldSizeToMaterialSize(worldSize: number, fovDeg: number): number {
  return worldSize / Math.tan(((fovDeg / 2) * Math.PI) / 180);
}
