/**
 * Uniform-grid spatial hash over a packed xyz array, for neighbor queries.
 * Points are counting-sorted by hashed cell, so a cell's points are the
 * contiguous range order[start[h] .. start[h + 1]). Hash collisions only add
 * extra candidates; callers filter by distance.
 *
 * Pure module with no imports (runs in a worker or Node).
 */

const TABLE_BITS = 21;
const TABLE = 1 << TABLE_BITS;
const MASK = TABLE - 1;

export type SpatialHash = {
  cell: number;
  minX: number;
  minY: number;
  minZ: number;
  start: Uint32Array;
  order: Uint32Array;
};

export function hashCell(ix: number, iy: number, iz: number) {
  return (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & MASK;
}

export function bounds(positions: ArrayLike<number>) {
  const n = Math.floor(positions.length / 3);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  for (let i = 0; i < n; i++) {
    if (positions[3 * i] < minX) minX = positions[3 * i];
    if (positions[3 * i + 1] < minY) minY = positions[3 * i + 1];
    if (positions[3 * i + 2] < minZ) minZ = positions[3 * i + 2];
  }
  return { minX, minY, minZ };
}

export function buildSpatialHash(positions: ArrayLike<number>, cell: number): SpatialHash {
  const n = Math.floor(positions.length / 3);
  const { minX, minY, minZ } = bounds(positions);
  const keys = new Uint32Array(n);
  const start = new Uint32Array(TABLE + 1);
  for (let i = 0; i < n; i++) {
    const h = hashCell(
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
  return { cell, minX, minY, minZ, start, order };
}

/**
 * Rough surface sample spacing (median over `samples` points): in a 10 cm
 * voxel holding c surface points, spacing ≈ 0.1 / √c.
 */
export function roughSpacing(positions: ArrayLike<number>, samples = 2000): number {
  const n = Math.floor(positions.length / 3);
  const grid = buildSpatialHash(positions, 0.1);
  const est: number[] = [];
  const step = Math.max(1, Math.floor(n / samples));
  for (let i = 0; i < n; i += step) {
    const h = hashCell(
      Math.floor((positions[3 * i] - grid.minX) / grid.cell),
      Math.floor((positions[3 * i + 1] - grid.minY) / grid.cell),
      Math.floor((positions[3 * i + 2] - grid.minZ) / grid.cell),
    );
    est.push(grid.cell / Math.sqrt(Math.max(1, grid.start[h + 1] - grid.start[h])));
  }
  est.sort((a, b) => a - b);
  return est[Math.floor(est.length / 2)];
}

/**
 * Writes the squared distances and indices of the k nearest neighbors of
 * point i (excluding i) into dist2/idx, ascending. Searches the 3×3×3 block
 * of cells around the point, so neighbors farther than one cell may be
 * missed (results are then slightly too far, never too near).
 * Returns how many neighbors were found (≤ k).
 */
export function kNearest(
  positions: ArrayLike<number>,
  grid: SpatialHash,
  i: number,
  k: number,
  dist2: Float64Array,
  idx: Int32Array,
): number {
  const { cell, minX, minY, minZ, start, order } = grid;
  const px = positions[3 * i], py = positions[3 * i + 1], pz = positions[3 * i + 2];
  const cx = Math.floor((px - minX) / cell);
  const cy = Math.floor((py - minY) / cell);
  const cz = Math.floor((pz - minZ) / cell);
  dist2.fill(Infinity, 0, k);
  idx.fill(-1, 0, k);
  let found = 0;
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const h = hashCell(cx + dx, cy + dy, cz + dz);
        for (let t = start[h]; t < start[h + 1]; t++) {
          const o = order[t];
          if (o === i) continue;
          const ex = positions[3 * o] - px, ey = positions[3 * o + 1] - py, ez = positions[3 * o + 2] - pz;
          const d2 = ex * ex + ey * ey + ez * ez;
          if (d2 >= dist2[k - 1]) continue;
          // Hash collisions can list the same point under two probed cells.
          let dup = false;
          for (let q = 0; q < k && dist2[q] <= d2; q++) if (idx[q] === o) { dup = true; break; }
          if (dup) continue;
          let p = k - 1;
          while (p > 0 && dist2[p - 1] > d2) {
            dist2[p] = dist2[p - 1];
            idx[p] = idx[p - 1];
            p--;
          }
          dist2[p] = d2;
          idx[p] = o;
          if (found < k) found++;
        }
      }
  return found;
}
