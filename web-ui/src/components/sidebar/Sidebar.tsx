"use client";

import { Layers, Sofa } from "lucide-react";
import DockPanel from "@/components/ui/DockPanel";
import ScenePanel from "./ScenePanel";
import FurniturePanel from "./FurniturePanel";

export default function Sidebar() {
  return (
    <DockPanel
      side="left"
      ariaLabel="Library"
      widthClass="w-72"
      tabs={[
        { id: "scene", label: "Scene", icon: Layers, content: <ScenePanel /> },
        { id: "furniture", label: "Furniture", icon: Sofa, content: <FurniturePanel /> },
      ]}
    />
  );
}
