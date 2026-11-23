"use client";

import { useState } from "react";
import { Box, RotateCcw, Upload } from "lucide-react";
import { Section, Segmented, Slider, Toggle } from "@/components/ui/controls";
import { useViewerStore, type BackgroundMode, type PointShape } from "@/store/viewer";

// Display settings drive the 3D view via the viewer store; the rest is UI only.

const SCENES = [
  { id: "room_fused", name: "room_fused.ply", points: "1.72M points", size: "26 MB" },
];

const BACKGROUND_OPTIONS = ["Dark", "Light"] as const;
const SHAPE_OPTIONS = ["Square", "Disc"] as const;

export default function ScenePanel() {
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const pointShape = useViewerStore((s) => s.pointShape);
  const setPointShape = useViewerStore((s) => s.setPointShape);
  const analysis = useViewerStore((s) => s.analysis);
  const pointScale = useViewerStore((s) => s.pointScale);
  const setPointScale = useViewerStore((s) => s.setPointScale);
  const [showGrid, setShowGrid] = useState(true);
  const [showInferred, setShowInferred] = useState(true);
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
                  onClick={() => setSceneId(s.id)}
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
                      {s.points} · {s.size}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
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
        <Toggle label="Show inferred points" checked={showInferred} onChange={setShowInferred} />
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
