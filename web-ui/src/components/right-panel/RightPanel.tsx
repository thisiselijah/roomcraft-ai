"use client";

import { MessageSquare, SlidersHorizontal } from "lucide-react";
import DockPanel from "@/components/ui/DockPanel";
import ChatPanel from "./ChatPanel";
import InspectorPanel from "./InspectorPanel";

export default function RightPanel() {
  return (
    <DockPanel
      side="right"
      ariaLabel="Assistant and properties"
      widthClass="w-80"
      tabs={[
        { id: "chat", label: "AI Assistant", icon: MessageSquare, content: <ChatPanel /> },
        { id: "inspector", label: "Properties", icon: SlidersHorizontal, content: <InspectorPanel /> },
      ]}
    />
  );
}
