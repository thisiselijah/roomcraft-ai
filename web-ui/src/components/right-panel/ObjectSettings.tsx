"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";
import { NumberField, Section, Select, Slider, Toggle, Vec3Field, type Vec3 } from "@/components/ui/controls";
import { CATEGORY_ICONS } from "@/components/objects/categoryIcons";
import { getCatalogItem } from "@/lib/objectCatalog";
import { useObjectStore, wrapDegrees, type PlacedObject } from "@/store/objects";

// Objects list, visibility/lock/delete and transform are live; Appearance and
// Placement are still UI only.

const MATERIALS = ["Fabric", "Leather", "Wood", "Metal", "Plastic"] as const;
const SNAP = ["Off", "1 cm", "5 cm", "10 cm", "25 cm"] as const;
const SWATCHES = ["#a1a1aa", "#78716c", "#92400e", "#1e3a8a", "#065f46", "#f5f5f4"];

const formatPosition = (p: PlacedObject["position"]): Vec3 => [p[0].toFixed(2), p[1].toFixed(2), p[2].toFixed(2)];

/**
 * Position editor: keeps the typed text while focused (so "1." isn't
 * reformatted mid-typing) and shows the live value otherwise, e.g. while the
 * object is dragged in the viewport.
 */
function PositionField({ object }: { object: PlacedObject }) {
  const update = useObjectStore((s) => s.update);
  const [draft, setDraft] = useState<{ id: string; value: Vec3 } | null>(null);
  const value = draft?.id === object.id ? draft.value : formatPosition(object.position);
  return (
    <div onBlur={() => setDraft(null)}>
      <Vec3Field
        label="Position"
        unit="m"
        step={0.05}
        value={value}
        onChange={(v) => {
          setDraft({ id: object.id, value: v });
          const n = v.map(Number);
          if (v.every((t) => t.trim() !== "") && n.every(Number.isFinite)) {
            update(object.id, { position: [n[0], n[1], n[2]] });
          }
        }}
      />
    </div>
  );
}

export default function ObjectSettings() {
  const objects = useObjectStore((s) => s.objects);
  const selectedId = useObjectStore((s) => s.selectedId);
  const select = useObjectStore((s) => s.select);
  const update = useObjectStore((s) => s.update);
  const remove = useObjectStore((s) => s.remove);

  const [material, setMaterial] = useState<(typeof MATERIALS)[number]>("Fabric");
  const [color, setColor] = useState(SWATCHES[0]);
  const [roughness, setRoughness] = useState(0.8);

  const [snapFloor, setSnapFloor] = useState(true);
  const [snapWall, setSnapWall] = useState(false);
  const [collision, setCollision] = useState(true);
  const [gridSnap, setGridSnap] = useState<(typeof SNAP)[number]>("5 cm");
  const [clearance, setClearance] = useState("60");

  const selected = objects.find((o) => o.id === selectedId) ?? null;
  const selectedItem = selected ? getCatalogItem(selected.catalogId) : undefined;
  const SelectedIcon = selectedItem ? CATEGORY_ICONS[selectedItem.category] : null;

  return (
    <div>
      <Section title="Objects in scene">
        {objects.length === 0 ? (
          <p className="text-sm text-zinc-500">No objects yet. Add one from the Furniture tab.</p>
        ) : (
          <ul className="space-y-0.5">
            {objects.map((o) => {
              const it = getCatalogItem(o.catalogId);
              const active = o.id === selectedId;
              const Icon = it ? CATEGORY_ICONS[it.category] : null;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => select(active ? null : o.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      active ? "bg-indigo-500/15 text-indigo-300" : "text-zinc-300 hover:bg-zinc-900"
                    } ${o.visible ? "" : "opacity-50"}`}
                  >
                    {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate">{it?.name ?? o.catalogId}</span>
                    {o.locked && <Lock className="size-3 shrink-0 text-zinc-500" aria-label="Locked" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {!selected ? (
        <p className="px-4 py-6 text-center text-sm text-zinc-500">
          Select an object in the list or click it in the viewport.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-md bg-zinc-900 text-indigo-400">
              {SelectedIcon && <SelectedIcon className="size-4" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
              {selectedItem?.name ?? selected.catalogId}
            </span>
            {[
              {
                label: selected.visible ? "Hide" : "Show",
                icon: selected.visible ? Eye : EyeOff,
                onClick: () => update(selected.id, { visible: !selected.visible }),
              },
              {
                label: selected.locked ? "Unlock" : "Lock",
                icon: selected.locked ? Lock : Unlock,
                onClick: () => update(selected.id, { locked: !selected.locked }),
              },
              { label: "Delete", icon: Trash2, onClick: () => remove(selected.id) },
            ].map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                type="button"
                title={label}
                onClick={onClick}
                className={`rounded-md p-1.5 transition-colors hover:bg-zinc-800 ${
                  label === "Delete" ? "text-zinc-500 hover:text-red-400" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                <span className="sr-only">{label}</span>
              </button>
            ))}
          </div>

          <Section title="Transform">
            <PositionField object={selected} />
            <Slider
              label="Rotation"
              value={selected.rotationY}
              min={-180}
              max={180}
              step={5}
              unit="°"
              onChange={(v) => update(selected.id, { rotationY: wrapDegrees(v) })}
            />
            <div className="flex items-center justify-between text-sm text-zinc-300">
              Size (W × D × H)
              <span className="font-mono text-xs text-zinc-500">
                {selectedItem?.dims ? `${selectedItem.dims.join(" × ")} cm` : "unknown"}
              </span>
            </div>
          </Section>

          <Section title="Appearance">
            <Select label="Material" value={material} options={MATERIALS} onChange={setMaterial} />
            <div className="flex items-center justify-between text-sm text-zinc-300">
              Color
              <div className="flex gap-1.5" role="radiogroup" aria-label="Color">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`size-5 rounded-full border border-zinc-600 ${
                      color === c ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-zinc-950" : ""
                    }`}
                  />
                ))}
              </div>
            </div>
            <Slider label="Roughness" value={roughness} min={0} max={1} step={0.05} onChange={setRoughness} />
          </Section>

          <Section title="Placement">
            <Toggle label="Snap to floor" checked={snapFloor} onChange={setSnapFloor} />
            <Toggle label="Snap to wall" checked={snapWall} onChange={setSnapWall} />
            <Toggle label="Collision check" checked={collision} onChange={setCollision} />
            <Select label="Grid snap" value={gridSnap} options={SNAP} onChange={setGridSnap} />
            <div className="flex items-center justify-between gap-3 text-sm text-zinc-300">
              Min. clearance
              <div className="w-28">
                <NumberField label="↔" value={clearance} unit="cm" step={5} onChange={setClearance} />
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
