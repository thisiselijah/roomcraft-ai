/// <reference lib="webworker" />
// Off-main-thread point analysis (~4–5 s for 1.7M points): per-point spacing,
// PCA normals and Voronoi coverage radius (lib/pointFeatures).
// Input: { positions: Float32Array } (transferred copy).
import { computePointFeatures } from "@/lib/pointFeatures";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<{ positions: Float32Array }>) => {
  const t0 = performance.now();
  const features = computePointFeatures(e.data.positions);
  ctx.postMessage(
    { features, ms: performance.now() - t0 },
    [features.spacing.buffer, features.normals.buffer, features.radius.buffer],
  );
};
