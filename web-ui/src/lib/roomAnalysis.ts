/**
 * Finds a good interior starting viewpoint for a scanned room.
 *
 * Works in the scan's own coordinates, which are assumed Z-up and in meters.
 * Pure function with no imports, so it can run in a worker or in Node.
 */

export type RoomAnalysis = {
  /** Bounding box of the scan (source coordinates). */
  min: [number, number, number];
  max: [number, number, number];
  /** Horizontal bbox center, used to center the room on the origin. */
  centerX: number;
  centerY: number;
  /** Robust floor / ceiling heights (source Z). */
  floorZ: number;
  ceilingZ: number;
  /**
   * Most open walkable spot (source XY) and the horizontal unit direction with
   * the longest unobstructed view from it. null if no walkable floor was found
   * (e.g. the scan is an object rather than a room).
   */
  start: { x: number; y: number; dirX: number; dirY: number; clearance: number } | null;
};

type Options = {
  /** Occupancy grid cell size in meters. */
  cell?: number;
  /** Height band above the floor that counts as an obstacle (walls, furniture). */
  obstacleMin?: number;
  obstacleMax?: number;
  /** Points per cell needed to count as floor / obstacle (noise rejection). */
  minPoints?: number;
};

export function analyzeRoom(positions: ArrayLike<number>, opts: Options = {}): RoomAnalysis {
  const { cell = 0.2, obstacleMin = 0.3, obstacleMax = 1.9, minPoints = 5 } = opts;
  const n = Math.floor(positions.length / 3);

  // 1. Bounds.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = positions[3 * i], y = positions[3 * i + 1], z = positions[3 * i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  // 2. Height histogram (1 cm bins) -> floor = densest layer in the lower part,
  //    ceiling = 99th percentile (scans often have little or no ceiling).
  const BIN = 0.01;
  const nb = Math.max(1, Math.ceil((maxZ - minZ) / BIN) + 1);
  const hist = new Uint32Array(nb);
  for (let i = 0; i < n; i++) hist[Math.floor((positions[3 * i + 2] - minZ) / BIN)]++;

  const percentileBin = (p: number) => {
    const target = p * n;
    let acc = 0;
    for (let b = 0; b < nb; b++) {
      acc += hist[b];
      if (acc >= target) return b;
    }
    return nb - 1;
  };
  const p01 = percentileBin(0.01);
  const p99 = percentileBin(0.99);
  const lowerLimit = p01 + Math.max(1, Math.floor((p99 - p01) * 0.3));
  let floorBin = p01;
  for (let b = p01; b <= lowerLimit; b++) if (hist[b] > hist[floorBin]) floorBin = b;
  const floorZ = minZ + (floorBin + 0.5) * BIN;
  const ceilingZ = minZ + (p99 + 0.5) * BIN;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const base: Omit<RoomAnalysis, "start"> = {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    centerX,
    centerY,
    floorZ,
    ceilingZ,
  };

  // 3. Top-down occupancy grid.
  const gw = Math.max(1, Math.ceil((maxX - minX) / cell));
  const gh = Math.max(1, Math.ceil((maxY - minY) / cell));
  const floorCount = new Uint32Array(gw * gh);
  const obstacleCount = new Uint32Array(gw * gh);
  for (let i = 0; i < n; i++) {
    const h = positions[3 * i + 2] - floorZ;
    const isFloor = h > -0.08 && h < 0.08;
    const isObstacle = h > obstacleMin && h < obstacleMax;
    if (!isFloor && !isObstacle) continue;
    const cx = Math.min(gw - 1, Math.floor((positions[3 * i] - minX) / cell));
    const cy = Math.min(gh - 1, Math.floor((positions[3 * i + 1] - minY) / cell));
    if (isFloor) floorCount[cy * gw + cx]++;
    else obstacleCount[cy * gw + cx]++;
  }

  // Walkable = scanned floor with nothing in the obstacle band above it.
  const walkable = new Uint8Array(gw * gh);
  let walkableCount = 0;
  for (let k = 0; k < gw * gh; k++) {
    if (floorCount[k] >= minPoints && obstacleCount[k] < minPoints) {
      walkable[k] = 1;
      walkableCount++;
    }
  }
  if (walkableCount === 0) return { ...base, start: null };

  // 4. Distance (in cells) from every walkable cell to the nearest
  //    non-walkable cell or the grid edge: two-pass chamfer transform.
  const INF = 1e9;
  const dist = new Float32Array(gw * gh);
  for (let k = 0; k < gw * gh; k++) dist[k] = walkable[k] ? INF : 0;
  const D = 1, DD = Math.SQRT2;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= gw || y >= gh ? 0 : dist[y * gw + x]);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const k = y * gw + x;
      if (!dist[k]) continue;
      dist[k] = Math.min(dist[k], at(x - 1, y) + D, at(x, y - 1) + D, at(x - 1, y - 1) + DD, at(x + 1, y - 1) + DD);
    }
  }
  for (let y = gh - 1; y >= 0; y--) {
    for (let x = gw - 1; x >= 0; x--) {
      const k = y * gw + x;
      if (!dist[k]) continue;
      dist[k] = Math.min(dist[k], at(x + 1, y) + D, at(x, y + 1) + D, at(x + 1, y + 1) + DD, at(x - 1, y + 1) + DD);
    }
  }

  // 5. Pick the most open cell, gently preferring the walkable area's centroid
  //    so ties don't end up in a far corner.
  let sx = 0, sy = 0;
  for (let k = 0; k < gw * gh; k++) if (walkable[k]) { sx += k % gw; sy += Math.floor(k / gw); }
  const mx = sx / walkableCount, my = sy / walkableCount;
  let best = -1, bestScore = -Infinity;
  for (let k = 0; k < gw * gh; k++) {
    if (!walkable[k]) continue;
    const x = k % gw, y = Math.floor(k / gw);
    const score = dist[k] - 0.05 * Math.hypot(x - mx, y - my);
    if (score > bestScore) { bestScore = score; best = k; }
  }
  const bx = best % gw, by = Math.floor(best / gw);

  // 6. Face the direction with the longest unobstructed ray.
  const RAYS = 32;
  let bestDir = 0, bestLen = -1;
  for (let r = 0; r < RAYS; r++) {
    const a = (r / RAYS) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    let len = 0;
    for (let t = 0.5; ; t += 0.5) {
      const x = Math.floor(bx + 0.5 + dx * t), y = Math.floor(by + 0.5 + dy * t);
      if (x < 0 || y < 0 || x >= gw || y >= gh) break;
      const k = y * gw + x;
      // Unscanned floor gaps are fine to look across; obstacles stop the ray.
      if (obstacleCount[k] >= minPoints) break;
      len = t;
    }
    if (len > bestLen) { bestLen = len; bestDir = a; }
  }

  return {
    ...base,
    start: {
      x: minX + (bx + 0.5) * cell,
      y: minY + (by + 0.5) * cell,
      dirX: Math.cos(bestDir),
      dirY: Math.sin(bestDir),
      clearance: dist[best] * cell,
    },
  };
}
