"use client";

import { useEffect, useState } from "react";
import { Box, RotateCcw, Upload } from "lucide-react";
import { Section, Segmented, Slider, Toggle } from "@/components/ui/controls";
import { useViewerStore, type BackgroundMode, type PointShape } from "@/store/viewer";
import { useObjectStore } from "@/store/objects";
import { getScene, SCENES, type SceneInfo, type SceneQuality, type SceneScale } from "@/lib/sceneCatalog";

// Scan choice and display settings drive the 3D view via the viewer store;
// grid, move speed, reset view and upload are UI only.

const BACKGROUND_OPTIONS = ["Dark", "Light"] as const;
const SHAPE_OPTIONS = ["Square", "Disc"] as const;

export default function ScenePanel() {
  const sceneId = useViewerStore((s) => s.sceneId);
  const setSceneId = useViewerStore((s) => s.setSceneId);
  const clearObjects = useObjectStore((s) => s.clear);
  const objectCount = useObjectStore((s) => s.objects.length);
  const scene = getScene(sceneId);
  const pointShape = useViewerStore((s) => s.pointShape);
  const setPointShape = useViewerStore((s) => s.setPointShape);
  const analysis = useViewerStore((s) => s.analysis);
  const pointScale = useViewerStore((s) => s.pointScale);
  const setPointScale = useViewerStore((s) => s.setPointScale);
  const [showGrid, setShowGrid] = useState(true);
  const showInferred = useViewerStore((s) => s.showInferred);
  const setShowInferred = useViewerStore((s) => s.setShowInferred);
  const background = useViewerStore((s) => s.background);
  const setBackground = useViewerStore((s) => s.setBackground);
  const [moveSpeed, setMoveSpeed] = useState(3);

  return (
    <div>
      <Section title="Scans">
        <ul className="space-y-1.5">
          {SCENES.map((s) => {
            const active = s.id === sceneId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (active) return;
                    // Placed furniture belongs to a room; start the new scan empty.
                    clearObjects();
                    setSceneId(s.id);
                  }}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-indigo-500/60 bg-indigo-500/10"
                      : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                  }`}
                >
                  <Box className="size-4 shrink-0 text-indigo-400" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-zinc-100">{s.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {formatPoints(s.points)} points · {s.sizeMB.toFixed(1)} MB
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {objectCount > 0 && (
          <p className="text-xs text-zinc-500">Switching scans removes the furniture placed in this one.</p>
        )}
        <SceneReport scene={scene} />
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          <Upload className="size-4" aria-hidden />
          Upload scan
        </button>
      </Section>

      <Section title="Display">
        <Slider
          label="Point size"
          value={pointScale}
          min={0.5}
          max={2}
          step={0.1}
          unit="×"
          onChange={setPointScale}
        />
        <div className="flex items-center justify-between gap-3 text-sm text-zinc-300">
          Point shape
          <div className="w-36">
            <Segmented
              label="Point shape"
              value={pointShape === "disc" ? "Disc" : "Square"}
              options={SHAPE_OPTIONS}
              onChange={(v) => setPointShape(v.toLowerCase() as PointShape)}
            />
          </div>
        </div>
        {pointShape === "disc" && analysis.status === "running" && (
          <p className="text-xs text-zinc-500">Analyzing points… (squares until ready)</p>
        )}
        {pointShape === "disc" && analysis.status === "error" && (
          <p className="text-xs text-zinc-500">Analysis failed; showing squares.</p>
        )}
        {pointShape === "disc" && analysis.status === "ready" && (
          <p className="font-mono text-[11px] leading-4 text-zinc-500">
            auto: disc R = {(analysis.medianRadius * 1000).toFixed(1)} mm ({analysis.radiusOverSpacing.toFixed(2)} d,
            Voronoi)
            <br />
            analysis {(analysis.ms / 1000).toFixed(1)} s
          </p>
        )}
        <Toggle label="Show grid" checked={showGrid} onChange={setShowGrid} />
        {scene.hasInferred && (
          <Toggle label="Show inferred points" checked={showInferred} onChange={setShowInferred} />
        )}
        <div className="flex items-center justify-between gap-3 text-sm text-zinc-300">
          Background
          <div className="w-32">
            <Segmented
              label="Background"
              value={background === "dark" ? "Dark" : "Light"}
              options={BACKGROUND_OPTIONS}
              onChange={(v) => setBackground(v.toLowerCase() as BackgroundMode)}
            />
          </div>
        </div>
      </Section>

      <Section title="Camera">
        <Slider
          label="Move speed"
          value={moveSpeed}
          min={1}
          max={10}
          step={0.5}
          unit=" m/s"
          onChange={setMoveSpeed}
        />
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
        >
          <RotateCcw className="size-4" aria-hidden />
          Reset view
        </button>
      </Section>
    </div>
  );
}

function formatPoints(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1e3)}k`;
}

const GRADE_COLORS: Record<string, string> = {
  good: "text-emerald-400",
  fair: "text-amber-300",
  poor: "text-rose-400",
};

type Report = { sceneId: string; quality: SceneQuality | null; scale: SceneScale | null };

/** Quality and scale summary from the scan's module A hand-off files. */
function SceneReport({ scene }: { scene: SceneInfo }) {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    const dir = scene.reportDir;
    if (!dir) return;
    let cancelled = false;
    const load = <T,>(file: string) =>
      fetch(`${dir}/${file}`)
        .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
        .catch(() => null);
    Promise.all([load<SceneQuality>("quality.json"), load<SceneScale>("scale.json")]).then(
      ([quality, scale]) => {
        if (!cancelled) setReport({ sceneId: scene.id, quality, scale });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [scene]);

  if (!scene.reportDir || report?.sceneId !== scene.id) return null;
  const { quality, scale } = report;
  if (!quality && !scale) return null;
  const extent = scale?.extent_m;

  return (
    <div className="space-y-1.5 rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-400">
      {quality && (
        <p>
          Quality{" "}
          <span className={`font-medium ${GRADE_COLORS[quality.overall] ?? "text-zinc-200"}`}>
            {quality.overall}
          </span>
          {quality.metrics.coverage_pct !== undefined && <> · coverage {quality.metrics.coverage_pct}%</>}
          {quality.metrics.floor_sd_cm !== undefined && <> · floor ±{quality.metrics.floor_sd_cm} cm</>}
        </p>
      )}
      {extent && (
        <p className="font-mono text-[11px]">
          {extent.x.toFixed(2)} × {extent.y.toFixed(2)} × {extent.z.toFixed(2)} m
        </p>
      )}
      {scale?.note && <p className="leading-4 text-zinc-500">Scale: {scale.note}</p>}
      {quality?.hints && quality.hints.length > 0 && (
        <details className="text-zinc-500">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">
            Capture tips ({quality.hints.length})
          </summary>
          <ul className="mt-1 list-disc space-y-1 pl-4 leading-4">
            {quality.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
