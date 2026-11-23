"use client";

import type { ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-zinc-800 px-4 py-4 last:border-b-0">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-zinc-300">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
          checked ? "bg-indigo-500" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      <span className="mb-1.5 flex items-center justify-between">
        {label}
        <span className="font-mono text-xs tabular-nums text-zinc-500">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500"
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 0.1,
  accent = "text-zinc-500",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  step?: number;
  /** Tailwind text color for the label, e.g. axis colors. */
  accent?: string;
}) {
  return (
    <label className="flex h-8 min-w-0 items-center rounded-md border border-zinc-800 bg-zinc-900 focus-within:border-indigo-500">
      <span className={`w-6 shrink-0 text-center text-[11px] font-semibold ${accent}`}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent pr-1 text-right font-mono text-xs tabular-nums text-zinc-100 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {unit && <span className="shrink-0 pr-2 text-[11px] text-zinc-500">{unit}</span>}
    </label>
  );
}

export type Vec3 = [string, string, string];

const AXES = [
  { label: "X", accent: "text-red-400" },
  { label: "Y", accent: "text-green-400" },
  { label: "Z", accent: "text-sky-400" },
] as const;

export function Vec3Field({
  label,
  value,
  onChange,
  unit,
  step,
}: {
  label: string;
  value: Vec3;
  onChange: (v: Vec3) => void;
  unit?: string;
  step?: number;
}) {
  return (
    <div>
      <div className="mb-1.5 text-sm text-zinc-300">{label}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {AXES.map((a, i) => (
          <NumberField
            key={a.label}
            label={a.label}
            accent={a.accent}
            value={value[i]}
            unit={unit}
            step={step}
            onChange={(v) => {
              const next = [...value] as Vec3;
              next[i] = v;
              onChange(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-zinc-900 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            value === o ? "bg-zinc-700 text-zinc-100 shadow" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
