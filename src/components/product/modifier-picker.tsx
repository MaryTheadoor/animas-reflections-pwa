"use client";

/**
 * A compact picker for modifier groups with many options.
 *
 * A design set can hold 50+ options; rendering them as chips made the product
 * page several screens long. Small groups stay as chips; a big group collapses
 * to one button showing what is selected, and opens a searchable panel with
 * thumbnails. Multi-select is preserved because the cart expresses a design
 * choice as add-ons, exactly like the customizer.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { ProductModifier } from "@/types";
import { formatModifierDelta, type ModifierGroup } from "@/lib/modifier-selection";

export default function ModifierPicker({
  group,
  selectedIds,
  onToggle,
  thumbnailFor,
  selectedLabelFor,
}: {
  group: ModifierGroup;
  selectedIds: string[];
  onToggle: (id: string) => void;
  thumbnailFor: (modifier: ProductModifier) => string | undefined;
  selectedLabelFor?: (modifier: ProductModifier) => string | undefined;
}) {
  const single = group.selectionType === "single";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => group.modifiers.filter((m) => selectedIds.includes(m.id)),
    [group.modifiers, selectedIds],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return group.modifiers;
    return group.modifiers.filter((m) => (m.name ?? "").toLowerCase().includes(q));
  }, [group.modifiers, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-warm-sand text-foreground hover:bg-warm-sand/80 border border-primary/10"
          aria-haspopup="dialog"
        >
          {selected.length > 0
            ? `${selected.length} selected — change`
            : `${single ? "Choose one" : "Choose"} from ${group.modifiers.length} ${group.name.toLowerCase()}`}
        </button>
        {selected.slice(0, 3).map((mod) => (
          <span
            key={mod.id}
            className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl text-xs bg-primary text-white"
          >
            {thumbnailFor(mod) && (
              <Image
                src={thumbnailFor(mod)!}
                alt=""
                aria-hidden="true"
                width={20}
                height={20}
                className="rounded object-cover bg-white/40"
              />
            )}
            <span>{selectedLabelFor?.(mod) ?? mod.name}</span>
            <button
              type="button"
              onClick={() => onToggle(mod.id)}
              aria-label={`Remove ${mod.name}`}
              className="text-white/70 hover:text-white"
            >
              ×
            </button>
          </span>
        ))}
        {selected.length > 3 && (
          <span className="text-[11px] text-foreground/70">+{selected.length - 3} more</span>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-primary/40 backdrop-blur-sm p-0 sm:p-6"
          onMouseDown={(e) => {
            if (!dialogRef.current?.contains(e.target as Node)) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={group.name}
            className="bg-white w-full sm:max-w-2xl max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-warm-sand space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold font-display text-sm">{group.name}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs font-medium text-gold-deep hover:underline"
                >
                  Done
                </button>
              </div>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${group.modifiers.length} options…`}
                aria-label={`Search ${group.name}`}
                className="w-full px-3 py-2 rounded-lg border border-primary/20 text-sm focus:border-gold outline-none"
              />
              <p className="text-[11px] text-foreground/70">
                {single
                  ? "Choose one — picking a different option replaces this one."
                  : "Choose as many as you like — each one is added to the order with its own price."}
              </p>
            </div>

            <div className="p-4 overflow-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
              {matches.map((mod) => {
                const active = selectedIds.includes(mod.id);
                const delta = formatModifierDelta(mod);
                const thumb = thumbnailFor(mod);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onToggle(mod.id);
                      // A single choice is complete once made, so close the panel.
                      if (single && !active) setOpen(false);
                    }}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-colors ${
                      active
                        ? "border-gold bg-gold/10"
                        : "border-primary/15 hover:border-primary/30 bg-white"
                    }`}
                  >
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt=""
                        aria-hidden="true"
                        width={40}
                        height={40}
                        className="rounded object-cover shrink-0 bg-warm-sand"
                      />
                    ) : (
                      <span className="w-10 h-10 rounded bg-warm-sand/60 shrink-0" aria-hidden="true" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-xs font-medium truncate">{mod.name}</span>
                      {delta && <span className="block text-[10px] text-gold-deep">{delta}</span>}
                    </span>
                    {active && <span className="ml-auto text-gold-deep text-xs" aria-hidden="true">✓</span>}
                  </button>
                );
              })}
              {matches.length === 0 && (
                <p className="col-span-full text-xs text-foreground/70">
                  Nothing matches “{query.trim()}”.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
