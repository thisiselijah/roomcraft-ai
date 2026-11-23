"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Armchair,
  Bed,
  BedSingle,
  BookOpen,
  Flower2,
  Frame,
  Lamp,
  LampDesk,
  LampFloor,
  RectangleHorizontal,
  Search,
  Sofa,
  Tv,
  type LucideIcon,
} from "lucide-react";

// UI only: a placeholder catalog; "Add to scene" does nothing yet.

const CATEGORIES = ["All", "Seating", "Tables", "Beds", "Storage", "Lighting", "Decor"] as const;
type Category = (typeof CATEGORIES)[number];

type Item = {
  id: string;
  name: string;
  category: Exclude<Category, "All">;
  dims: string; // W × D × H, cm
  icon: LucideIcon;
};

const CATALOG: Item[] = [
  { id: "sofa-3", name: "3-Seat Sofa", category: "Seating", dims: "210 × 90 × 85", icon: Sofa },
  { id: "armchair", name: "Armchair", category: "Seating", dims: "80 × 85 × 90", icon: Armchair },
  { id: "dining-table", name: "Dining Table", category: "Tables", dims: "180 × 90 × 75", icon: RectangleHorizontal },
  { id: "coffee-table", name: "Coffee Table", category: "Tables", dims: "110 × 60 × 45", icon: RectangleHorizontal },
  { id: "double-bed", name: "Double Bed", category: "Beds", dims: "160 × 210 × 100", icon: Bed },
  { id: "single-bed", name: "Single Bed", category: "Beds", dims: "90 × 200 × 90", icon: BedSingle },
  { id: "bookshelf", name: "Bookshelf", category: "Storage", dims: "80 × 30 × 200", icon: BookOpen },
  { id: "cabinet", name: "Cabinet", category: "Storage", dims: "120 × 45 × 80", icon: Archive },
  { id: "tv-stand", name: "TV Stand", category: "Storage", dims: "160 × 40 × 50", icon: Tv },
  { id: "floor-lamp", name: "Floor Lamp", category: "Lighting", dims: "40 × 40 × 160", icon: LampFloor },
  { id: "desk-lamp", name: "Desk Lamp", category: "Lighting", dims: "15 × 15 × 45", icon: LampDesk },
  { id: "pendant", name: "Pendant Light", category: "Lighting", dims: "45 × 45 × 30", icon: Lamp },
  { id: "plant", name: "Potted Plant", category: "Decor", dims: "40 × 40 × 120", icon: Flower2 },
  { id: "wall-art", name: "Wall Art", category: "Decor", dims: "90 × 3 × 60", icon: Frame },
];

export default function FurniturePanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter(
      (it) =>
        (category === "All" || it.category === category) &&
        (!q || it.name.toLowerCase().includes(q)),
    );
  }, [query, category]);

  const selected = CATALOG.find((it) => it.id === selectedId) ?? null;

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-3 border-b border-zinc-800 px-4 py-4">
        <label className="relative block">
          <span className="sr-only">Search furniture</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search furniture"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-1.5 pr-3 pl-8 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categories">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                category === c
                  ? "bg-indigo-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No furniture matches.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {items.map((it) => {
              const active = it.id === selectedId;
              const Icon = it.icon;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(active ? null : it.id)}
                    aria-pressed={active}
                    className={`w-full rounded-lg border p-2 text-left transition-colors ${
                      active
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                    }`}
                  >
                    <span className="mb-2 flex aspect-[4/3] items-center justify-center rounded-md bg-zinc-900">
                      <Icon
                        className={`size-8 ${active ? "text-indigo-400" : "text-zinc-400"}`}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </span>
                    <span className="block truncate text-sm text-zinc-100">{it.name}</span>
                    <span className="block font-mono text-[11px] text-zinc-500">{it.dims} cm</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
        <p className="mb-2 truncate text-xs text-zinc-500">
          {selected ? (
            <>
              Selected: <span className="text-zinc-200">{selected.name}</span>
            </>
          ) : (
            "Select an item to place"
          )}
        </p>
        <button
          type="button"
          disabled={!selected}
          className="w-full rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          Add to scene
        </button>
      </div>
    </div>
  );
}
