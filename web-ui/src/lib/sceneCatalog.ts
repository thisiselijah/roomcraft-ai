/**
 * Room scans served from public/scene (a symlink to ../../scene). Each scan
 * lives in its own folder: scene/<id>/<id>.ply, plus the module A hand-off
 * files (quality.json, scale.json) when the pipeline wrote them.
 *
 * All scans are in meters, right-handed and Z-up, with a per-vertex
 * `inferred` flag: 0 = measured, 1 = flat patch, 2 = smooth (Poisson) fill.
 */

export type SceneInfo = {
  id: string;
  /** File name shown in the UI. */
  name: string;
  url: string;
  points: number;
  /** File size in MB. */
  sizeMB: number;
  /** Whether the scan has inferred (hole-filling) points to hide. */
  hasInferred: boolean;
  /** Folder URL of quality.json / scale.json, if the scan has them. */
  reportDir: string | null;
};

function scene(id: string, points: number, sizeMB: number, hasInferred: boolean, hasReport: boolean): SceneInfo {
  return {
    id,
    name: `${id}.ply`,
    url: `/scene/${id}/${id}.ply`,
    points,
    sizeMB,
    hasInferred,
    reportDir: hasReport ? `/scene/${id}` : null,
  };
}

export const SCENES: SceneInfo[] = [
  scene("room_filled", 158_955, 2.4, true, true),
  scene("room_fused", 1_724_393, 26.3, false, false),
];

export const DEFAULT_SCENE_ID = SCENES[0].id;

export function getScene(id: string): SceneInfo {
  return SCENES.find((s) => s.id === id) ?? SCENES[0];
}

/** module A quality.json (only the fields the UI shows). */
export type SceneQuality = {
  overall: string;
  grades: Record<string, string>;
  metrics: { consistency_cm?: number; coverage_pct?: number; floor_sd_cm?: number };
  hints?: string[];
};

/** module A scale.json (only the fields the UI shows). */
export type SceneScale = {
  method: string;
  note?: string;
  extent_m?: { x: number; y: number; z: number };
};
