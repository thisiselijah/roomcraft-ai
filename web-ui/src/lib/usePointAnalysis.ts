"use client";

import { useEffect, useState } from "react";
import type { BufferAttribute, BufferGeometry } from "three";
import type { PointFeatures } from "./pointFeatures";
import { attributeToFloat32 } from "./displayGeometry";

export type PointAnalysis = {
  features: PointFeatures;
  ms: number;
};

export type PointAnalysisState =
  | { status: "running" }
  | { status: "ready"; analysis: PointAnalysis }
  | { status: "error" };

const RUNNING: PointAnalysisState = { status: "running" };

/**
 * Per-point spacing, normals and coverage radius for a geometry, computed in
 * a Web Worker. "running" until the worker answers.
 */
export function usePointAnalysis(geometry: BufferGeometry): PointAnalysisState {
  const [result, setResult] = useState<{ geometry: BufferGeometry; state: PointAnalysisState } | null>(
    null,
  );

  useEffect(() => {
    const worker = new Worker(new URL("../workers/pointAnalysis.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<PointAnalysis>) => {
      setResult({ geometry, state: { status: "ready", analysis: e.data } });
      worker.terminate();
    };
    worker.onerror = (e) => {
      console.error("Point analysis failed:", e.message);
      setResult({ geometry, state: { status: "error" } });
      worker.terminate();
    };
    // Float32 copy; transferring the original would detach the geometry's buffer.
    const positions = attributeToFloat32(geometry.getAttribute("position") as BufferAttribute);
    worker.postMessage({ positions }, [positions.buffer]);
    return () => worker.terminate();
  }, [geometry]);

  return result && result.geometry === geometry ? result.state : RUNNING;
}
