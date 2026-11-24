/**
 * Non-reactive glue between the DOM panels, the canvas and the camera
 * controls for placing and dragging objects.
 */

import type { Vec3 } from "@/store/objects";

// --- Drop point -------------------------------------------------------------

let dropPointProvider: (() => Vec3) | null = null;

/** Registered by the canvas: where "Add to scene" should put a new object. */
export function setDropPointProvider(provider: (() => Vec3) | null) {
  dropPointProvider = provider;
}

export function getDropPoint(): Vec3 {
  return dropPointProvider?.() ?? [0, 0, 0];
}

// --- Dragging ---------------------------------------------------------------

export type ObjectDrag = {
  id: string;
  /**
   * Screen offset (NDC) from the cursor to the object's base point when the
   * drag started. The base point, which lies on the floor, is kept at this
   * offset from the cursor and moved along the floor. (Moving the grabbed
   * point on a horizontal plane instead breaks down when it is near eye
   * height: that plane is almost parallel to the view.)
   */
  ndcOffsetX: number;
  ndcOffsetY: number;
};

let drag: ObjectDrag | null = null;

export function startObjectDrag(d: ObjectDrag) {
  drag = d;
}

export function endObjectDrag() {
  drag = null;
}

/** The current drag, if any. Camera look is suspended while one is active. */
export function getObjectDrag(): ObjectDrag | null {
  return drag;
}
