"use client";

/**
 * The product page's design choice, collapsed when the set is large.
 *
 * A design set can hold 97 entries, which rendered as a wall of chips several
 * screens long. Small sets stay as chips — the choice is the whole point on a
 * puzzle or a hat — and a large set collapses to one button that opens a
 * searchable panel with thumbnails. Selection is single: the customer picks the
 * one design that gets printed.
 *
 * The label comes from `designAssetLabel`, because 97 of the designs share
 * `name: "Little Stranger Logos"` and carry their real title in `description`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { DesignAsset } from "@/types";
import { designAssetLabel, filterDesignAssets } from "@/lib/design-assets";

/** Above this many designs, the list collapses into the panel. */
const INLINE_LIMIT = 8;

export default function DesignPicker({
  assets,
  selected,
  onSelect,
}: {
  assets: DesignAsset[];
  selected: DesignAsset | null;
  onSelect: (asset: DesignAsset | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => filterDesignAssets(assets, query), [assets, query]);

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

  if (assets.length === 0) return null;

  if (assets.length <= INLINE_LIMIT) {
    return (
      <div className="flex flex-wrap gap-2">
        {assets.map((design) => {
          const active = selected?.id === design.id;
          const label = designAssetLabel(design);
          return (
            <button
              key={design.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? null : design)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                active
                  ? "bg-gold/10 border-gold/40 text-gold-deep"
                  : "bg-warm-sand/30 border-transparent text-foreground hover:border-primary/20"
              }`}
            >
              <Image
                src={design.image_url}
                alt=""
                aria-hidden="true"
                width={28}
                height={28}
                className="rounded object-cover shrink-0"
              />
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-warm-sand text-foreground hover:bg-warm-sand/80 border border-primary/10"
        >
          {selected ? `Design: ${designAssetLabel(selected)} — change` : `Choose from ${assets.length} designs`}
        </button>
        {selected && (
          <span className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl text-xs bg-primary text-white">
            <Image
              src={selected.image_url}
              alt=""
              aria-hidden="true"
              width={20}
              height={20}
              className="rounded object-cover bg-white/40"
            />
            <span>{designAssetLabel(selected)}</span>
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label={`Remove ${designAssetLabel(selected)}`}
              className="text-white/70 hover:text-white"
            >
              ×
            </button>
          </span>
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
            aria-label="Choose a design"
            className="bg-white w-full sm:max-w-2xl max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-warm-sand space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold font-display text-sm">Choose a design</h2>
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
                placeholder={`Search ${assets.length} designs…`}
                aria-label="Search designs"
                className="w-full px-3 py-2 rounded-lg border border-primary/20 text-sm focus:border-gold outline-none"
              />
              <p className="text-[11px] text-foreground/70">
                Pick the one design you want printed. You can move or resize it afterwards with
                “Customize This”.
              </p>
            </div>

            <div className="p-4 overflow-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
              {matches.map((design) => {
                const active = selected?.id === design.id;
                const label = designAssetLabel(design);
                return (
                  <button
                    key={design.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onSelect(active ? null : design);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-colors ${
                      active
                        ? "border-gold bg-gold/10"
                        : "border-primary/15 hover:border-primary/30 bg-white"
                    }`}
                  >
                    <Image
                      src={design.image_url}
                      alt=""
                      aria-hidden="true"
                      width={40}
                      height={40}
                      className="rounded object-cover shrink-0 bg-warm-sand"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium truncate">{label}</span>
                    </span>
                    {active && (
                      <span className="ml-auto text-gold-deep text-xs" aria-hidden="true">
                        ✓
                      </span>
                    )}
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
