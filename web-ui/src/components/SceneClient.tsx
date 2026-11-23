"use client";

import dynamic from "next/dynamic";

// Three.js needs `window`/WebGL, so the canvas is rendered on the client only.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

export default function SceneClient() {
  return <Scene />;
}
