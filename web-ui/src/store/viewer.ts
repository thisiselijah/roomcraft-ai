import { create } from "zustand";
import { DEFAULT_SCENE_ID } from "@/lib/sceneCatalog";

export type BackgroundMode = "dark" | "light";

/** Colors for the 3D view per background mode. */
export const BACKGROUND_THEMES: Record<
  BackgroundMode,
  { background: string; gridCell: string; gridSection: string }
> = {
  dark: { background: "#111111", gridCell: "#3f3f46", gridSection: "#6366f1" },
  light: { background: "#f4f4f5", gridCell: "#d4d4d8", gridSection: "#818cf8" },
};

type Vec3 = [number, number, number];

/** A camera pose in world coordinates (Y-up, floor at y = 0). */
export type CameraView = { position: Vec3; target: Vec3 };

/** What the sidebar shows about the point analysis. */
export type AnalysisInfo =
  | { status: "idle" | "running" | "error" }
  | {
      status: "ready";
      ms: number;
      /** Median Voronoi coverage radius (m) and as a multiple of spacing. */
      medianRadius: number;
      radiusOverSpacing: number;
    };

/** "square": plain GL points; "disc": Voronoi-sized discs (crisp, gap-free). */
export type PointShape = "square" | "disc";

type ViewerState = {
  /** Active room scan (see lib/sceneCatalog.ts). */
  sceneId: string;
  setSceneId: (id: string) => void;
  /** Show inferred (hole-filling) points; off keeps measured points only. */
  showInferred: boolean;
  setShowInferred: (show: boolean) => void;
  pointShape: PointShape;
  setPointShape: (shape: PointShape) => void;
  analysis: AnalysisInfo;
  setAnalysis: (info: AnalysisInfo) => void;
  /** Multiplier on the auto-estimated point size. */
  pointScale: number;
  setPointScale: (scale: number) => void;
  background: BackgroundMode;
  setBackground: (mode: BackgroundMode) => void;
  /** Starting view computed from the loaded scan; null until it has loaded. */
  homeView: CameraView | null;
  setHomeView: (view: CameraView | null) => void;
};

/** Viewer settings shared between the UI panels and the 3D scene. */
export const useViewerStore = create<ViewerState>()((set) => ({
  sceneId: DEFAULT_SCENE_ID,
  setSceneId: (sceneId) => set({ sceneId }),
  showInferred: true,
  setShowInferred: (showInferred) => set({ showInferred }),
  pointShape: "disc",
  setPointShape: (pointShape) => set({ pointShape }),
  analysis: { status: "idle" },
  setAnalysis: (analysis) => set({ analysis }),
  pointScale: 1,
  setPointScale: (pointScale) => set({ pointScale }),
  background: "dark",
  setBackground: (background) => set({ background }),
  homeView: null,
  setHomeView: (homeView) => set({ homeView }),
}));
