"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { OBJECT_CATALOG, OBJECT_CATEGORIES, type ObjectCategory } from "@/lib/objectCatalog";
import { getDropPoint } from "@/lib/objectInteraction";
import { useObjectStore } from "@/store/objects";

const CATEGORIES = ["All", ...OBJECT_CATEGORIES] as const;
type Category = "All" | ObjectCategory;

/** Catalog of object point clouds; metric ones can be added to the scene. */
export default function FurniturePanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const add = useObjectStore((s) => s.add);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return OBJECT_CATALOG.filter(
      (it) =>
        (category === "All" || it.category === category) &&
        (!q || it.name.toLowerCase().includes(q)),
    );
  }, [query, category]);

  const selected = OBJECT_CATALOG.find((it) => it.id === selectedId) ?? null;
  const addSelected = () => {
    if (selected?.metric) add(selected.id, getDropPoint());
  };

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
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    disabled={!it.metric}
                    onClick={() => setSelectedId(active ? null : it.id)}
                    onDoubleClick={() => it.metric && add(it.id, getDropPoint())}
                    aria-pressed={active}
                    title={it.metric ? "Double-click to add" : "No metric size yet (normalized units)"}
                    className={`w-full rounded-lg border p-2 text-left transition-colors disabled:cursor-not-allowed ${
                      active
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-zinc-800 enabled:hover:border-zinc-700 enabled:hover:bg-zinc-900"
                    }`}
                  >
                    <span className="relative mb-2 block aspect-[4/3] overflow-hidden rounded-md bg-zinc-900">
                      <Image
                        src={it.thumbnail}
                        alt=""
                        fill
                        sizes="128px"
                        unoptimized
                        className={`object-cover ${it.metric ? "" : "opacity-40 grayscale"}`}
                      />
                      {!it.metric && (
                        <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-amber-300">
                          Needs scale
                        </span>
                      )}
                    </span>
                    <span className={`block truncate text-sm ${it.metric ? "text-zinc-100" : "text-zinc-500"}`}>
                      {it.name}
                    </span>
                    <span className="block font-mono text-[11px] text-zinc-500">
                      {it.dims ? `${it.dims.join(" × ")} cm` : "size unknown"}
                    </span>
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
          disabled={!selected?.metric}
          onClick={addSelected}
          className="w-full rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          Add to scene
        </button>
      </div>
    </div>
  );
}
