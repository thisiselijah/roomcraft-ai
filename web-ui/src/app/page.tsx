import SceneClient from "@/components/SceneClient";
import Sidebar from "@/components/sidebar/Sidebar";
import RightPanel from "@/components/right-panel/RightPanel";

export default function Home() {
  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#111]">
      <Sidebar />
      {/* relative: anchors the scene's overlays (loader, key help) */}
      <div className="relative min-w-0 flex-1">
        <SceneClient />
      </div>
      <RightPanel />
    </main>
  );
}
