"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { BoxGeometry, EdgesGeometry, Plane, Raycaster, Vector2, Vector3, type BufferGeometry } from "three";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { makeDisplayGeometry } from "@/lib/displayGeometry";
import { usePointAnalysis } from "@/lib/usePointAnalysis";
import { getCatalogItem } from "@/lib/objectCatalog";
import {
  endObjectDrag,
  getObjectDrag,
  setDropPointProvider,
  startObjectDrag,
} from "@/lib/objectInteraction";
import { useObjectStore, wrapDegrees, type PlacedObject, type Vec3 } from "@/store/objects";
import { isEditableFocused } from "@/components/FlyControls";
import PointSplats from "@/components/PointSplats";

/** Farthest a new object is dropped along the view ray, in meters. */
const MAX_DROP_DISTANCE = 6;
/** Distance ahead used when the view ray doesn't reach the floor. */
const FALLBACK_DROP_DISTANCE = 2.5;
/** Max distance from the camera an object can be dragged to, in meters. */
const MAX_DRAG_DISTANCE = 30;
const DEG = Math.PI / 180;

/** All placed objects, plus the drop-point, drag and hotkey handlers. */
export default function PlacedObjects() {
  const objects = useObjectStore((s) => s.objects);
  return (
    <>
      <DropPoint />
      <DragController />
      <Hotkeys />
      {objects.map((o) => (
        <Suspense key={o.id} fallback={null}>
          <PlacedObjectView object={o} />
        </Suspense>
      ))}
    </>
  );
}

/**
 * Local frame of a metric object, normalized so its base center is the
 * origin: center x/z on the bounding box and put the lowest point at y = 0.
 * (Metric PLYs are already Y-up and in meters, so this is the only
 * calibration they need.)
 */
function objectFrame(geometry: BufferGeometry): { offset: Vec3; size: Vec3 } {
  const p = geometry.getAttribute("position").array;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return {
    offset: [-(minX + maxX) / 2, -minY, -(minZ + maxZ) / 2],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
  };
}

function PlacedObjectView({ object }: { object: PlacedObject }) {
  const item = getCatalogItem(object.catalogId)!;
  const loaded = useLoader(PLYLoader, item.url, (loader) =>
    loader.setCustomPropertyNameMapping({ srgb: ["red", "green", "blue"] }),
  );
  const geometry = useMemo(() => makeDisplayGeometry(loaded), [loaded]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const frame = useMemo(() => objectFrame(geometry), [geometry]);
  const analysis = usePointAnalysis(geometry);

  const selected = useObjectStore((s) => s.selectedId === object.id);
  const select = useObjectStore((s) => s.select);
  const [w, h, d] = frame.size;

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(object.id);
    if (object.locked) return;
    const base = new Vector3(...object.position).project(e.camera);
    if (base.z > 1) return; // base point behind the camera
    startObjectDrag({
      id: object.id,
      ndcOffsetX: base.x - e.pointer.x,
      ndcOffsetY: base.y - e.pointer.y,
    });
    document.body.style.cursor = "grabbing";
  };

  return (
    <group position={object.position} rotation={[0, object.rotationY * DEG, 0]} visible={object.visible}>
      <PointSplats geometry={geometry} analysis={analysis} position={frame.offset} />
      {object.visible && (
        // Invisible bounding box used for picking (cheaper than raycasting points).
        <mesh
          visible={false}
          position={[0, h / 2, 0]}
          onPointerDown={onPointerDown}
          onPointerOver={(e) => {
            e.stopPropagation();
            if (!getObjectDrag()) document.body.style.cursor = object.locked ? "pointer" : "grab";
          }}
          onPointerOut={() => {
            if (!getObjectDrag()) document.body.style.cursor = "";
          }}
        >
          <boxGeometry args={[w, h, d]} />
        </mesh>
      )}
      {selected && <SelectionBox size={frame.size} />}
    </group>
  );
}

function SelectionBox({ size }: { size: Vec3 }) {
  const geometry = useMemo(() => {
    const box = new BoxGeometry(...size);
    const edges = new EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [size]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} position={[0, size[1] / 2, 0]} renderOrder={1}>
      <lineBasicMaterial color="#818cf8" depthTest={false} transparent opacity={0.9} toneMapped={false} />
    </lineSegments>
  );
}

/** Tells "Add to scene" where the camera is looking on the floor. */
function DropPoint() {
  const getState = useThree((s) => s.get);
  useEffect(() => {
    const dir = new Vector3();
    setDropPointProvider(() => {
      const { camera } = getState();
      const p = camera.position;
      camera.getWorldDirection(dir);
      const t = dir.y < -1e-3 ? -p.y / dir.y : Infinity;
      if (t > 0 && t <= MAX_DROP_DISTANCE) return [p.x + dir.x * t, 0, p.z + dir.z * t];
      // Looking level or up: drop it a little ahead, on the floor.
      const hLen = Math.hypot(dir.x, dir.z) || 1;
      return [
        p.x + (dir.x / hLen) * FALLBACK_DROP_DISTANCE,
        0,
        p.z + (dir.z / hLen) * FALLBACK_DROP_DISTANCE,
      ];
    });
    return () => setDropPointProvider(null);
  }, [getState]);
  return null;
}

/** Moves the dragged object so the grabbed point follows the cursor. */
function DragController() {
  const getState = useThree((s) => s.get);
  useEffect(() => {
    const { gl } = getState();
    const dom = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const basePlane = new Plane(new Vector3(0, 1, 0), 0);
    const hit = new Vector3();

    const onPointerMove = (e: PointerEvent) => {
      const drag = getObjectDrag();
      if (!drag) return;
      const rect = dom.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1 + drag.ndcOffsetX,
        -((e.clientY - rect.top) / rect.height) * 2 + 1 + drag.ndcOffsetY,
      );
      const { objects, update } = useObjectStore.getState();
      const obj = objects.find((o) => o.id === drag.id);
      if (!obj) return;
      raycaster.setFromCamera(ndc, getState().camera);
      // Move the base point on the horizontal plane at its own height (the
      // floor unless Y was edited). Ignore rays above or near the horizon,
      // where the hit runs off to infinity.
      basePlane.constant = -obj.position[1];
      if (!raycaster.ray.intersectPlane(basePlane, hit)) return;
      if (hit.distanceTo(raycaster.ray.origin) > MAX_DRAG_DISTANCE) return;
      update(drag.id, { position: [hit.x, obj.position[1], hit.z] });
    };
    const onPointerUp = () => {
      if (!getObjectDrag()) return;
      endObjectDrag();
      document.body.style.cursor = "";
    };

    dom.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      endObjectDrag();
    };
  }, [getState]);
  return null;
}

/** R rotates the selection 90°, Delete/Backspace removes it, Esc deselects. */
function Hotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableFocused() || e.metaKey || e.ctrlKey || e.altKey) return;
      const { objects, selectedId, update, remove, select } = useObjectStore.getState();
      const obj = objects.find((o) => o.id === selectedId);
      if (!obj) return;
      if (e.code === "KeyR" && !obj.locked) {
        update(obj.id, { rotationY: wrapDegrees(obj.rotationY + (e.shiftKey ? -90 : 90)) });
      } else if ((e.code === "Delete" || e.code === "Backspace") && !obj.locked) {
        e.preventDefault();
        remove(obj.id);
      } else if (e.code === "Escape") {
        select(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
