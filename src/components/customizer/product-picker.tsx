"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ManagedProduct } from "@/types";
import {
  buildProductPickerGroups,
  filterProductPickerGroups,
  flattenProductPickerOptions,
  indexOfProductOption,
  indexProductPickerGroups,
  moveActiveIndex,
  type ProductPickerOption,
} from "@/lib/customizer-product-picker";

interface ProductPickerProps {
  products: readonly ManagedProduct[];
  categories: readonly { id: string; name: string }[];
  /** Currently selected product id ("" when none). */
  selectedProductId: string;
  /** Label for the current selection. Passed in rather than looked up in the
   *  option list, because the preselected product may be unpriced or inactive
   *  and so absent from the options. */
  selectedLabel: string;
  onSelect: (productId: string) => void;
}

/** Searchable product combobox grouped by product type.
 *
 *  ARIA 1.2 combobox: the text input owns `role="combobox"`, the popup is a
 *  `listbox`, and the active option is carried by `aria-activedescendant` so
 *  focus never leaves the input. Keyboard: ArrowDown/ArrowUp move (wrapping),
 *  Home/End jump to the ends, Enter selects, Escape closes and restores the
 *  selection label. */
export default function ProductPicker({
  products,
  categories,
  selectedProductId,
  selectedLabel,
  onSelect,
}: ProductPickerProps) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxRef = useRef<HTMLDivElement | null>(null);

  const groups = useMemo(
    () => buildProductPickerGroups(products, categories),
    [products, categories],
  );
  const visibleGroups = useMemo(
    () => filterProductPickerGroups(groups, query),
    [groups, query],
  );

  // One walk over the visible groups produces both the render order and the
  // keyboard order, so the two can never disagree.
  const renderGroups = useMemo(() => indexProductPickerGroups(visibleGroups), [visibleGroups]);
  const options = useMemo(() => flattenProductPickerOptions(visibleGroups), [visibleGroups]);

  const scrollActiveIntoView = (index: number) => {
    const node = listboxRef.current?.querySelector(`[data-index="${index}"]`);
    node?.scrollIntoView({ block: "nearest" });
  };

  const moveActive = (index: number) => {
    setActiveIndex(index);
    scrollActiveIntoView(index);
  };

  const openList = () => {
    if (open) return;
    setOpen(true);
    const index = indexOfProductOption(options, selectedProductId);
    moveActive(index >= 0 ? index : 0);
  };

  const closeList = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  const commit = (option: ProductPickerOption) => {
    onSelect(option.id);
    closeList();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else moveActive(moveActiveIndex(activeIndex, 1, options.length));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else moveActive(moveActiveIndex(activeIndex, -1, options.length));
        break;
      case "Home":
        if (!open) return;
        event.preventDefault();
        if (options.length > 0) moveActive(0);
        break;
      case "End":
        if (!open) return;
        event.preventDefault();
        if (options.length > 0) moveActive(options.length - 1);
        break;
      case "Enter": {
        if (!open) {
          event.preventDefault();
          openList();
          return;
        }
        const target = options[activeIndex];
        if (target) {
          event.preventDefault();
          commit(target);
        }
        break;
      }
      case "Escape":
        if (!open) return;
        // Own the key so an outer dialog (the cart drawer, the mobile menu)
        // does not also close on the same press.
        event.preventDefault();
        event.stopPropagation();
        closeList();
        break;
      case "Tab":
        if (open) closeList();
        break;
      default:
        break;
    }
  };

  const activeOption = open ? options[activeIndex] : undefined;
  const inputValue = open ? query : selectedLabel;

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOption ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          aria-label="Product"
          autoComplete="off"
          value={inputValue}
          placeholder="Search products…"
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            if (!open) setOpen(true);
          }}
          onFocus={openList}
          // `onFocus` only fires once: after Escape (or a selection) the input
          // keeps focus, so a click is what reopens the list.
          onClick={openList}
          onKeyDown={handleKeyDown}
          onBlur={(event) => {
            if (!event.currentTarget.parentElement?.parentElement?.contains(event.relatedTarget as Node | null)) {
              closeList();
            }
          }}
          className="w-full p-2.5 pr-8 border border-primary/20 rounded-xl bg-white text-sm text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-foreground/60"
        >
          ▼
        </span>
      </div>

      {open && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Products"
          className="absolute z-10 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-primary/20 rounded-xl shadow-lg py-1"
        >
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-foreground/70">No products match.</p>
          )}
          {renderGroups.map((group) => (
            <div key={group.value} role="group" aria-label={group.label}>
              <p
                aria-hidden="true"
                className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/60"
              >
                {group.label}
              </p>
              {group.options.map((option, offset) => {
                const index = group.start + offset;
                const isActive = index === activeIndex;
                const isSelected = option.id === selectedProductId;
                return (
                  <div
                    key={option.id}
                    id={optionId(index)}
                    data-index={index}
                    data-product-id={option.id}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event) => {
                      // Select on mousedown, not click: preventDefault keeps
                      // focus in the input (so the blur handler cannot close the
                      // list first), and a click would then land on a node that
                      // no longer exists.
                      event.preventDefault();
                      commit(option);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-sm ${
                      isActive ? "bg-warm-sand" : ""
                    } ${isSelected ? "font-semibold text-primary" : "text-foreground"}`}
                  >
                    <span className="w-3 shrink-0 text-gold-deep" aria-hidden="true">
                      {isSelected ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.detail && (
                        <span className="block text-[10px] font-normal text-foreground/70 truncate">
                          {option.detail}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-gold-deep">
                      from ${option.price.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* The input's own value is the visible selection; this announces the
          change for screen readers without repeating the label on every render. */}
      <span className="sr-only" role="status" aria-live="polite">
        {selectedProductId ? `Selected ${selectedLabel}` : ""}
      </span>
    </div>
  );
}
