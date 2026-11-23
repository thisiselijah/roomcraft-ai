"use client";

import { useState } from "react";
import { Eye, EyeOff, Lamp, Lock, RectangleHorizontal, Sofa, Trash2, Unlock, type LucideIcon } from "lucide-react";
import { NumberField, Section, Select, Slider, Toggle, Vec3Field, type Vec3 } from "@/components/ui/controls";

// UI only: mock placed objects; edits are local and don't touch the scene.

type Placed = { id: string; name: string; icon: LucideIcon };

const PLACED: Placed[] = [
  { id: "sofa-1", name: "3-Seat Sofa", icon: Sofa },
  { id: "table-1", name: "Coffee Table", icon: RectangleHorizontal },
  { id: "lamp-1", name: "Floor Lamp", icon: Lamp },
];

const MATERIALS = ["Fabric", "Leather", "Wood", "Metal", "Plastic"] as const;
const SNAP = ["Off", "1 cm", "5 cm", "10 cm", "25 cm"] as const;
const SWATCHES = ["#a1a1aa", "#78716c", "#92400e", "#1e3a8a", "#065f46", "#f5f5f4"];

export default function ObjectSettings() {
  const [selectedId, setSelectedId] = useState(PLACED[0].id);
  const [visible, setVisible] = useState(true);
  const [locked, setLocked] = useState(false);

  const [position, setPosition] = useState<Vec3>(["4.20", "0.00", "-1.10"]);
  const [rotationY, setRotationY] = useState(90);
  const [size, setSize] = useState<Vec3>(["210", "90", "85"]);
  const [uniform, setUniform] = useState(true);

  const [material, setMaterial] = useState<(typeof MATERIALS)[number]>("Fabric");
  const [color, setColor] = useState(SWATCHES[0]);
  const [roughness, setRoughness] = useState(0.8);

  const [snapFloor, setSnapFloor] = useState(true);
  const [snapWall, setSnapWall] = useState(false);
  const [collision, setCollision] = useState(true);
  const [gridSnap, setGridSnap] = useState<(typeof SNAP)[number]>("5 cm");
  const [clearance, setClearance] = useState("60");

  const selected = PLACED.find((p) => p.id === selectedId)!;
  const SelectedIcon = selected.icon;

  return (
    <div>
      <Section title="Objects in scene">
        <ul className="space-y-0.5">
          {PLACED.map((p) => {
            const active = p.id === selectedId;
            const Icon = p.icon;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    active ? "bg-indigo-500/15 text-indigo-300" : "text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {p.name}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-md bg-zinc-900 text-indigo-400">
          <SelectedIcon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{selected.name}</span>
        {[
          {
            label: visible ? "Hide" : "Show",
            icon: visible ? Eye : EyeOff,
            onClick: () => setVisible((v) => !v),
          },
          {
            label: locked ? "Unlock" : "Lock",
            icon: locked ? Lock : Unlock,
            onClick: () => setLocked((v) => !v),
          },
          { label: "Delete", icon: Trash2, onClick: () => {} },
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
        <Vec3Field label="Position" unit="m" step={0.01} value={position} onChange={setPosition} />
        <Slider label="Rotation" value={rotationY} min={-180} max={180} step={5} unit="°" onChange={setRotationY} />
        <Vec3Field label="Size (W · H · D)" unit="cm" step={1} value={size} onChange={setSize} />
        <Toggle label="Lock proportions" checked={uniform} onChange={setUniform} />
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
    </div>
  );
}
