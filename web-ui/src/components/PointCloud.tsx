"use client";

import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { analyzeRoom } from "@/lib/roomAnalysis";
import { useViewerStore, type CameraView } from "@/store/viewer";
import { usePointAnalysis } from "@/lib/usePointAnalysis";
import { makeDisplayGeometry } from "@/lib/displayGeometry";
import PointSplats from "./PointSplats";

type Props = {
  url: string;
  /**
   * PointsMaterial.size override. Omit to derive it from the cloud's point
   * spacing (see lib/pointSize.ts).
   */
  pointSize?: number;
  /** Starting camera height above the floor, in meters. */
  eyeHeight?: number;
};

/** Z-up scan -> Y-up world. */
const ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];

export default function PointCloud({ url, pointSize, eyeHeight = 1.6 }: Props) {
  // PLYLoader reads x/y/z and colors; the raw sRGB bytes are also kept as a
  // custom "srgb" attribute so colors can be decoded at 16-bit precision.
  const loaded = useLoader(PLYLoader, url, (loader) =>
    loader.setCustomPropertyNameMapping({ srgb: ["red", "green", "blue"] }),
  );
  const geometry = useMemo(() => makeDisplayGeometry(loaded), [loaded]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Floor height, horizontal center and an open interior viewpoint (~25 ms).
  const room = useMemo(
    () => analyzeRoom(geometry.getAttribute("position").array),
    [geometry],
  );

  // Per-point spacing, normals and coverage radius (worker, a few seconds).
  // Plain points render until it's ready.
  const analysisState = usePointAnalysis(geometry);
  const setAnalysis = useViewerStore((s) => s.setAnalysis);
  useEffect(() => {
    if (analysisState.status !== "ready") {
      setAnalysis({ status: analysisState.status });
      return;
    }
    const { features, ms } = analysisState.analysis;
    setAnalysis({
      status: "ready",
      ms,
      medianRadius: features.medianRadius,
      radiusOverSpacing: features.medianRadius / features.medianSpacing,
    });
  }, [analysisState, setAnalysis]);
  useEffect(() => () => setAnalysis({ status: "idle" }), [setAnalysis]);

  // The scan is Z-up; Three.js is Y-up. Points are rotated -90° about X,
  // (x, y, z) -> (x, z, -y), then the group centers the room horizontally and
  // puts the detected floor at y = 0. The cached geometry is never mutated.
  const offset = useMemo<[number, number, number]>(
    () => [-room.centerX, -room.floorZ, room.centerY],
    [room],
  );

  // Publish the starting view in world coordinates for the camera controls.
  const setHomeView = useViewerStore((s) => s.setHomeView);
  useEffect(() => {
    const toWorld = (x: number, y: number, z: number): [number, number, number] => [
      x + offset[0],
      z + offset[1],
      -y + offset[2],
    ];

    let view: CameraView;
    if (room.start) {
      const { x, y, dirX, dirY } = room.start;
      // Stay below the ceiling in low rooms.
      const eyeZ = room.floorZ + Math.min(eyeHeight, (room.ceilingZ - room.floorZ) * 0.6);
      // Look 3 m ahead, slightly downward.
      view = {
        position: toWorld(x, y, eyeZ),
        target: toWorld(x + dirX * 3, y + dirY * 3, eyeZ - 0.4),
      };
    } else {
      // No walkable floor (e.g. an object scan): fall back to an outside overview.
      const [minX, minY] = room.min;
      const [maxX, maxY, maxZ] = room.max;
      const extent = Math.max(maxX - minX, maxY - minY, maxZ - room.floorZ);
      const cx = room.centerX, cy = room.centerY;
      view = {
        position: toWorld(cx + extent * 0.7, cy - extent * 0.8, room.floorZ + extent * 0.7),
        target: toWorld(cx, cy, room.floorZ + (maxZ - room.floorZ) * 0.3),
      };
    }
    setHomeView(view);
    return () => setHomeView(null);
  }, [room, offset, eyeHeight, setHomeView]);

  return (
    <PointSplats
      geometry={geometry}
      analysis={analysisState}
      position={offset}
      rotation={ROTATION}
      pointSize={pointSize}
    />
  );
}
