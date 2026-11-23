"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/controls";
import SceneSettings from "./SceneSettings";
import ObjectSettings from "./ObjectSettings";

const VIEWS = ["Scene", "Object"] as const;

export default function InspectorPanel() {
  const [view, setView] = useState<(typeof VIEWS)[number]>("Object");

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <Segmented label="Inspector target" value={view} options={VIEWS} onChange={setView} />
      </div>
      {/* Both stay mounted so values persist when switching. */}
      <div hidden={view !== "Scene"}>
        <SceneSettings />
      </div>
      <div hidden={view !== "Object"}>
        <ObjectSettings />
      </div>
    </div>
  );
}
