"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { BufferGeometry } from "three";
import { DiscPointsMaterial } from "./DiscPointsMaterial";

type Props = {
  geometry: BufferGeometry;
  position: [number, number, number];
  rotation: [number, number, number];
  /** Per-point coverage radius (m) and normals from the point analysis. */
  radius: Float32Array;
  normals: Float32Array;
  sizeScale?: number;
};

/** Gap-free crisp points: Voronoi-sized discs with paraboloid depth. */
export default function DiscPoints({ geometry, position, rotation, radius, normals, sizeScale = 1 }: Props) {
  const discs = useMemo(() => new DiscPointsMaterial(geometry, radius, normals), [geometry, radius, normals]);
  useEffect(() => () => discs.dispose(), [discs]);
  useEffect(() => discs.setSizeScale(sizeScale), [discs, sizeScale]);
  useFrame(({ gl, camera }) => discs.update(gl, camera));

  return (
    <group position={position}>
      <points geometry={discs.geometry} material={discs.material} rotation={rotation} />
    </group>
  );
}
