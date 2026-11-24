import { create } from "zustand";

export type Vec3 = [number, number, number];

/** A catalog object placed in the room (world coordinates, Y-up, meters). */
export type PlacedObject = {
  id: string;
  catalogId: string;
  /** Base center of the object; y = 0 is the floor. */
  position: Vec3;
  /** Rotation about the vertical axis, in degrees (-180, 180]. */
  rotationY: number;
  visible: boolean;
  locked: boolean;
};

type ObjectsState = {
  objects: PlacedObject[];
  selectedId: string | null;
  /** Places a catalog object and selects it. Returns its id. */
  add: (catalogId: string, position: Vec3) => string;
  update: (id: string, patch: Partial<Omit<PlacedObject, "id" | "catalogId">>) => void;
  remove: (id: string) => void;
  select: (id: string | null) => void;
  /** Removes every object (e.g. when switching to another room scan). */
  clear: () => void;
};

let nextId = 1;

/** Wraps degrees to (-180, 180]. */
export function wrapDegrees(deg: number): number {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** Objects placed in the scene, shared between the UI panels and the canvas. */
export const useObjectStore = create<ObjectsState>()((set) => ({
  objects: [],
  selectedId: null,
  add: (catalogId, position) => {
    const id = `obj-${nextId++}`;
    set((s) => ({
      objects: [...s.objects, { id, catalogId, position, rotationY: 0, visible: true, locked: false }],
      selectedId: id,
    }));
    return id;
  },
  update: (id, patch) =>
    set((s) => ({ objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
  remove: (id) =>
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  select: (selectedId) => set({ selectedId }),
  clear: () => set({ objects: [], selectedId: null }),
}));
