"use client";

import { useState, type ReactNode } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  type LucideIcon,
} from "lucide-react";

export type DockTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
};

type Props = {
  side: "left" | "right";
  tabs: DockTab[];
  /** Tailwind width class for the open panel, e.g. "w-72". Must be a literal. */
  widthClass?: string;
  defaultOpen?: boolean;
  ariaLabel: string;
};

/**
 * An always-visible icon rail plus a collapsible panel, docked to one side.
 * Clicking the active tab's icon (or a collapse button) hides the panel.
 * On small screens the panel overlays the canvas; from `md` up it pushes it.
 * All tab contents stay mounted so their state (e.g. a chat draft) survives
 * switching tabs or collapsing.
 */
export default function DockPanel({
  side,
  tabs,
  widthClass = "w-72",
  defaultOpen = true,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [tabId, setTabId] = useState(tabs[0].id);
  const panelId = `${side}-dock-panel`;
  const isLeft = side === "left";

  const onTabClick = (id: string) => {
    if (open && id === tabId) {
      setOpen(false);
    } else {
      setTabId(id);
      setOpen(true);
    }
  };

  const current = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const CollapseIcon = isLeft ? PanelLeftClose : PanelRightClose;
  const ExpandIcon = isLeft ? PanelLeftOpen : PanelRightOpen;

  return (
    <aside
      aria-label={ariaLabel}
      className={`relative flex h-full shrink-0 text-zinc-200 ${isLeft ? "" : "flex-row-reverse"}`}
    >
      <nav
        aria-label={`${ariaLabel} tabs`}
        className={`z-30 flex w-12 flex-col items-center gap-1 border-zinc-800 bg-zinc-950 py-3 ${
          isLeft ? "border-r" : "border-l"
        }`}
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = open && id === tabId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabClick(id)}
              aria-pressed={active}
              aria-controls={panelId}
              title={label}
              className={`flex size-9 items-center justify-center rounded-md transition-colors ${
                active
                  ? "bg-indigo-500/15 text-indigo-400"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              <span className="sr-only">{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          title={open ? "Collapse panel" : "Expand panel"}
          className="mt-auto flex size-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          {open ? <CollapseIcon className="size-5" aria-hidden /> : <ExpandIcon className="size-5" aria-hidden />}
          <span className="sr-only">{open ? "Collapse panel" : "Expand panel"}</span>
        </button>
      </nav>

      <div
        id={panelId}
        inert={!open}
        className={`absolute top-0 z-20 h-full overflow-hidden border-zinc-800 bg-zinc-950 transition-[width] duration-200 ease-out md:static ${
          isLeft ? "left-12" : "right-12"
        } ${open ? `${widthClass} ${isLeft ? "border-r" : "border-l"}` : "w-0"}`}
      >
        <div className={`flex h-full flex-col ${widthClass}`}>
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
            <h2 className="text-sm font-semibold text-zinc-100">{current.label}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              title="Collapse panel"
              className="flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <CollapseIcon className="size-4" aria-hidden />
              <span className="sr-only">Collapse panel</span>
            </button>
          </header>
          {tabs.map((t) => (
            <div key={t.id} hidden={t.id !== current.id} className="min-h-0 flex-1 overflow-y-auto">
              {t.content}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
