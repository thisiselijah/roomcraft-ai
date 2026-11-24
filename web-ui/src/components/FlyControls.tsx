"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useKeyboardControls, type KeyboardControlsEntry } from "@react-three/drei";
import { Euler, Vector3 } from "three";
import { useViewerStore } from "@/store/viewer";
import { getObjectDrag } from "@/lib/objectInteraction";

export type MoveAction =
  | "forward"
  | "backward"
  | "left"
  | "right"
  | "up"
  | "down"
  | "sprint";

/** Key bindings, by KeyboardEvent.code so they work regardless of keyboard layout / IME. */
export const moveKeyMap: KeyboardControlsEntry<MoveAction>[] = [
  { name: "forward", keys: ["KeyW", "ArrowUp"] },
  { name: "backward", keys: ["KeyS", "ArrowDown"] },
  { name: "left", keys: ["KeyA", "ArrowLeft"] },
  { name: "right", keys: ["KeyD", "ArrowRight"] },
  { name: "up", keys: ["KeyE", "Space"] },
  { name: "down", keys: ["KeyQ"] },
  { name: "sprint", keys: ["ShiftLeft", "ShiftRight"] },
];

type Props = {
  /** Point the camera looks at on mount, until the scan's home view is known. */
  initialTarget?: [number, number, number];
  /** Keyboard movement speed in meters per second. */
  speed?: number;
  /** Speed multiplier while Shift is held. */
  sprintMultiplier?: number;
  /** Radians of rotation per pixel of left-drag. */
  lookSpeed?: number;
  /** Meters of movement per pixel of right-drag. */
  panSpeed?: number;
  /** Meters of movement per pixel of wheel scroll. */
  wheelSpeed?: number;
};

const UP = new Vector3(0, 1, 0);
const MAX_PITCH = Math.PI / 2 - 0.01;

/** Whether a text field has focus (keyboard shortcuts should be ignored). */
export function isEditableFocused() {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/**
 * First-person camera for walking through a scanned room.
 *
 * Mouse: left-drag looks around in place, right-drag pans (moves the camera
 * in the screen plane), wheel moves along the view direction.
 * Keyboard: WASD / arrows move on the horizontal plane, E/Space and Q move
 * up/down, Shift sprints.
 */
export default function FlyControls({
  initialTarget = [0, 1, 0],
  speed = 3,
  sprintMultiplier = 3,
  lookSpeed = 0.004,
  panSpeed = 0.01,
  wheelSpeed = 0.01,
}: Props) {
  const [, getKeys] = useKeyboardControls<MoveAction>();
  // Read camera / canvas through get() inside effects and frames, so they are
  // never mutated as render-time values (react-hooks/immutability).
  const getState = useThree((s) => s.get);

  const angles = useRef({ yaw: 0, pitch: 0 });
  const forward = useRef(new Vector3()).current;
  const right = useRef(new Vector3()).current;
  const move = useRef(new Vector3()).current;

  const [tx, ty, tz] = initialTarget;

  const homeView = useViewerStore((s) => s.homeView);

  // Aim at the initial target, then jump to the scan's computed home view once
  // it is available. Yaw/pitch are re-seeded from the resulting orientation.
  useEffect(() => {
    const { camera } = getState();
    if (homeView) {
      camera.position.set(...homeView.position);
      camera.lookAt(...homeView.target);
    } else {
      camera.lookAt(tx, ty, tz);
    }
    const e = new Euler().setFromQuaternion(camera.quaternion, "YXZ");
    angles.current = { yaw: e.y, pitch: e.x };
    camera.rotation.order = "YXZ";
  }, [getState, homeView, tx, ty, tz]);

  // Mouse: left = look, right = pan, wheel = forward/back.
  useEffect(() => {
    const { camera, gl } = getState();
    const dom = gl.domElement;
    let button: number | null = null;
    const tmp = new Vector3();

    const applyRotation = () => {
      const a = angles.current;
      camera.rotation.set(a.pitch, a.yaw, 0, "YXZ");
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      button = e.button;
      dom.setPointerCapture(e.pointerId);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== button) return;
      button = null;
      if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (button === null) return;
      const dx = e.movementX;
      const dy = e.movementY;
      if (button === 0) {
        // Left-drag on a placed object moves the object instead.
        if (getObjectDrag()) return;
        // FPS-style: drag right looks right, drag down looks down.
        // Use a negative lookSpeed for "grab the world" (Street View) style.
        const a = angles.current;
        a.yaw -= dx * lookSpeed;
        a.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, a.pitch - dy * lookSpeed));
        applyRotation();
      } else {
        // Drag the scene: content follows the cursor.
        tmp.set(1, 0, 0).applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(tmp, -dx * panSpeed);
        tmp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(tmp, dy * panSpeed);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines -> px
      const step = Math.max(-2, Math.min(2, -px * wheelSpeed)); // cap per event
      camera.getWorldDirection(tmp);
      camera.position.addScaledVector(tmp, step);
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    dom.style.touchAction = "none";
    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("contextmenu", onContextMenu);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("contextmenu", onContextMenu);
    };
  }, [getState, lookSpeed, panSpeed, wheelSpeed]);

  // Keyboard movement.
  useFrame(({ camera }, delta) => {
    // Keys are captured on window; don't fly while the user types in the UI.
    if (isEditableFocused()) return;
    const k = getKeys();
    const f = Number(k.forward) - Number(k.backward);
    const r = Number(k.right) - Number(k.left);
    const u = Number(k.up) - Number(k.down);
    if (!f && !r && !u) return;

    const yaw = angles.current.yaw;
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); // horizontal heading
    right.crossVectors(forward, UP).normalize();

    move
      .set(0, 0, 0)
      .addScaledVector(forward, f)
      .addScaledVector(right, r)
      .addScaledVector(UP, u);
    if (move.lengthSq() === 0) return;

    // Clamp delta so a tab switch doesn't teleport the camera.
    const dt = Math.min(delta, 0.1);
    move.normalize().multiplyScalar(speed * (k.sprint ? sprintMultiplier : 1) * dt);
    camera.position.add(move);
  });

  return null;
}
