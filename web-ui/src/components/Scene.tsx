"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, Loader, KeyboardControls } from "@react-three/drei";
import { CircleHelp } from "lucide-react";
import PointCloud from "./PointCloud";
import FlyControls, { moveKeyMap } from "./FlyControls";
import PlacedObjects from "./objects/PlacedObjects";
import { BACKGROUND_THEMES, useViewerStore } from "@/store/viewer";
import { useObjectStore } from "@/store/objects";
import { getScene } from "@/lib/sceneCatalog";

export default function Scene() {
  const mode = useViewerStore((s) => s.background);
  const theme = BACKGROUND_THEMES[mode];
  const select = useObjectStore((s) => s.select);
  const scene = getScene(useViewerStore((s) => s.sceneId));
  const showInferred = useViewerStore((s) => s.showInferred);

  return (
    <KeyboardControls map={moveKeyMap}>
      <Canvas
        camera={{ position: [10, 10, 12], fov: 50, near: 0.05, far: 200 }}
        // A left click on empty space (not a drag) clears the selection.
        onPointerMissed={(e) => e.button === 0 && select(null)}
      >
        <color attach="background" args={[theme.background]} />
        <Suspense fallback={null}>
          <PointCloud key={scene.id} url={scene.url} showInferred={showInferred} />
        </Suspense>
        <PlacedObjects />
        <Grid
          infiniteGrid
          cellSize={0.5}
          sectionSize={2}
          fadeDistance={40}
          cellColor={theme.gridCell}
          sectionColor={theme.gridSection}
        />
        <FlyControls initialTarget={[0, 1, 0]} speed={3} />
      </Canvas>
      {/* Download progress overlay (DOM, outside the canvas) */}
      <Loader />
      {/* Controls help: hidden until the icon is hovered (or focused, for touch/keyboard). */}
      <div className="group absolute bottom-3 left-3">
        <button
          type="button"
          aria-describedby="controls-help"
          className={`flex size-8 items-center justify-center rounded-md transition-colors ${
            mode === "dark"
              ? "bg-black/60 text-zinc-400 hover:text-zinc-100"
              : "bg-white/75 text-zinc-500 shadow hover:text-zinc-900"
          }`}
        >
          <CircleHelp className="size-4" aria-hidden />
          <span className="sr-only">Show controls</span>
        </button>
        <div
          id="controls-help"
          role="tooltip"
          className={`invisible absolute bottom-full left-0 mb-2 w-max rounded px-3 py-2 font-mono text-xs leading-5 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${
            mode === "dark" ? "bg-black/75 text-zinc-300" : "bg-white/90 text-zinc-700 shadow"
          }`}
        >
          WASD / 方向鍵 移動 · E / Space 上升 · Q 下降 · Shift 加速
          <br />
          左鍵拖曳 轉動視角 · 右鍵拖曳 平移 · 滾輪 前進 / 後退
          <br />
          點選家具 選取 · 拖曳家具 移動 · R / Shift+R 旋轉 90° · Delete 刪除 · Esc 取消選取
        </div>
      </div>
    </KeyboardControls>
  );
}
