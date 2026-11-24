"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import type { BufferGeometry, PerspectiveCamera } from "three";
import { estimatePointSize, worldSizeToMaterialSize } from "@/lib/pointSize";
import type { PointAnalysisState } from "@/lib/usePointAnalysis";
import { useViewerStore } from "@/store/viewer";
import DiscPoints from "./discs/DiscPoints";

type V3 = [number, number, number];
const ZERO: V3 = [0, 0, 0];

type Props = {
  geometry: BufferGeometry;
  /** Per-point analysis; discs need it, square points render until it's ready. */
  analysis: PointAnalysisState;
  position?: V3;
  rotation?: V3;
  /**
   * PointsMaterial.size override for square points. Omit to derive it from the
   * cloud's point spacing (see lib/pointSize.ts).
   */
  pointSize?: number;
};

/**
 * Draws a point cloud with the viewer's point shape and size settings:
 * Voronoi-sized discs once the analysis is ready, plain square points before
 * that (or when "square" is chosen).
 */
export default function PointSplats({ geometry, analysis, position = ZERO, rotation = ZERO, pointSize }: Props) {
  const pointScale = useViewerStore((s) => s.pointScale);
  const pointShape = useViewerStore((s) => s.pointShape);

  // Auto point size: the hole-vs-blur loss minimizer (~0.2 s for 1.7M points),
  // converted from world width to material size for the current camera FOV.
  const fov = useThree((s) => (s.camera as PerspectiveCamera).fov ?? 50);
  const spacing = useMemo(
    () => (pointSize === undefined ? estimatePointSize(geometry.getAttribute("position").array) : null),
    [geometry, pointSize],
  );

  if (pointShape === "disc" && analysis.status === "ready") {
    const { features } = analysis.analysis;
    return (
      <DiscPoints
        geometry={geometry}
        position={position}
        rotation={rotation}
        radius={features.radius}
        normals={features.normals}
        sizeScale={pointScale}
      />
    );
  }

  const size = (pointSize ?? worldSizeToMaterialSize(spacing!.worldSize, fov)) * pointScale;
  return (
    <group position={position}>
      <points geometry={geometry} rotation={rotation}>
        <pointsMaterial
          size={size}
          sizeAttenuation
          vertexColors={geometry.hasAttribute("color")}
          // Scanned colors are final; R3F's default ACES tone mapping would
          // shift their saturation and contrast.
          toneMapped={false}
        />
      </points>
    </group>
  );
}
