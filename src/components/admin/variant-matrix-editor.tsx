"use client";

import { useState, useMemo } from "react";
import type { ManagedVariant, ProductOption } from "@/types";
import { PRODUCT_SIZES, PRODUCT_COLORS } from "@/lib/constants";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import {
  combinationKey,
  matrixCombinations,
  missingCombinations,
  variantSku,
  visibleGridCombinations,
} from "@/lib/variant-matrix";

/** One dimension of the variant matrix (e.g. Size, Color, Material). */
interface Dimension {
  name: string;
  values: string[];
}

interface VariantMatrixEditorProps {
  variants: ManagedVariant[];
  onChange: (variants: ManagedVariant[]) => void;
  /** Product-defined option dimensions. When provided, the matrix is built from
   *  these dimensions (N-dimensional). When omitted, falls back to the
   *  site-standard Size × Color grid for backward compatibility. */
  options?: ProductOption[];
}

export default function VariantMatrixEditor({ variants, onChange, options }: VariantMatrixEditorProps) {
  const siteConfig = useSiteConfig();

  // Build the dimension list: product options take precedence; otherwise
  // fall back to site-standard sizes × colors.
  const dimensions: Dimension[] = useMemo(() => {
    if (options && options.length > 0) {
      return options
        .filter((o) => o.type !== "text" && o.values.length > 0)
        .map((o) => ({ name: o.name, values: o.values }));
    }
    const sizes = siteConfig.catalog_options?.sizes?.length
      ? siteConfig.catalog_options.sizes
      : [...PRODUCT_SIZES] as readonly string[];
    const colors = siteConfig.catalog_options?.colors?.length
      ? siteConfig.catalog_options.colors.map((c) => c.name)
      : [...PRODUCT_COLORS] as readonly string[];
    return [
      { name: "Size", values: [...sizes] },
      { name: "Color", values: [...colors] },
    ];
  }, [options, siteConfig]);

  // Index existing matrix variants by their dimension-value signature.
  // Supports both structured options and legacy "A / B" name parsing.
  const existingMatrix = useMemo(() => {
    const matrix = new Map<string, ManagedVariant>();
    variants.forEach((v) => {
      if (v.options) {
        matrix.set(dimensions.map((d) => v.options![d.name] ?? "").join("|"), v);
      } else {
        const parts = v.name.split(" / ").map((p) => p.trim());
        if (parts.length === dimensions.length && parts.every(Boolean)) {
          matrix.set(parts.join("|"), v);
        }
      }
    });
    return matrix;
  }, [variants, dimensions]);

  const [basePrice, setBasePrice] = useState(() => {
    const first = variants[0];
    return first?.price ? String(first.price) : "";
  });
  const [baseSku, setBaseSku] = useState("");

  const toggleCell = (values: string[]) => {
    const key = values.join("|");
    const existing = existingMatrix.get(key);

    if (existing) {
      onChange(variants.filter((v) => v.id !== existing.id));
    } else {
      onChange([...variants, makeVariant(values, parseFloat(basePrice) || 0)]);
    }
  };

  /** The ManagedVariant one combination produces. */
  const makeVariant = (values: string[], price: number): ManagedVariant => {
    const optionMap: Record<string, string> = {};
    dimensions.forEach((d, i) => {
      optionMap[d.name] = values[i];
    });
    return {
      id: crypto.randomUUID(),
      name: values.join(" / "),
      price,
      sku: variantSku(values, baseSku),
      options: optionMap,
    };
  };

  const [fillNote, setFillNote] = useState<string | null>(null);

  /** Add every missing combination of the given set, in one write. */
  const addCombinations = (combinations: string[][], label: string) => {
    const existingKeys = new Set(existingMatrix.keys());
    const missing = missingCombinations(combinations, existingKeys);
    if (missing.length === 0) {
      setFillNote(`Nothing to add — all ${combinations.length} ${label} already exist.`);
      return;
    }
    // A big batch is worth confirming: this is one click creating real data.
    if (missing.length > 20 && !confirm(`Create ${missing.length} variants?`)) return;
    const price = parseFloat(basePrice) || 0;
    onChange([...variants, ...missing.map((values) => makeVariant(values, price))]);
    setFillNote(`Added ${missing.length} variant${missing.length === 1 ? "" : "s"} (${label}).`);
  };

  const removeCombinations = (combinations: string[][]) => {
    const doomed = new Set(
      combinations
        .map((values) => existingMatrix.get(combinationKey(values))?.id)
        .filter((id): id is string => Boolean(id)),
    );
    if (doomed.size === 0) {
      setFillNote("Nothing to remove from this view.");
      return;
    }
    if (doomed.size > 20 && !confirm(`Remove ${doomed.size} variants?`)) return;
    onChange(variants.filter((v) => !doomed.has(v.id)));
    setFillNote(`Removed ${doomed.size} variant${doomed.size === 1 ? "" : "s"} from this view.`);
  };

  /** Push the current base price onto every variant already created. */
  const applyPriceToAll = () => {
    const price = parseFloat(basePrice);
    if (Number.isNaN(price)) return;
    if (!confirm(`Set all ${variants.length} variant prices to $${price.toFixed(2)}?`)) return;
    onChange(variants.map((v) => ({ ...v, price })));
    setFillNote(`Set ${variants.length} variant prices to $${price.toFixed(2)}.`);
  };

  const [d1, d2, ...rest] = dimensions;
  const hasRest = rest.length > 0;
  // For 3+ dimensions the 2-D grid shows ONE combination of the extra
  // dimensions at a time; dropdowns pick which. (Previously extra dimensions
  // were baked in as empty strings, corrupting the variant options map and
  // creating duplicate variants with blank values.)
  const [extraSelections, setExtraSelections] = useState<Record<number, string>>({});
  const extraValues = rest.map((d, i) => extraSelections[i] ?? d.values[0]);

  const existingKeys = useMemo(() => new Set(existingMatrix.keys()), [existingMatrix]);
  const visibleCombinations = useMemo(
    () => visibleGridCombinations(dimensions, extraSelections),
    [dimensions, extraSelections],
  );
  const allCombinations = useMemo(() => matrixCombinations(dimensions), [dimensions]);
  const visibleMissing = useMemo(
    () => missingCombinations(visibleCombinations, existingKeys).length,
    [visibleCombinations, existingKeys],
  );
  const allMissing = useMemo(
    () => missingCombinations(allCombinations, existingKeys).length,
    [allCombinations, existingKeys],
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-primary mb-1">Base Price ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="29.99"
            className="w-28 px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-primary mb-1">SKU Prefix</label>
          <input
            type="text"
            value={baseSku}
            onChange={(e) => setBaseSku(e.target.value)}
            placeholder="BH"
            className="w-28 px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
          />
        </div>
      </div>

      <p className="text-xs text-foreground/80">
        Click cells to toggle variants, or fill the whole set at once. {variants.length} variant(s)
        selected.
        {dimensions.length > 0 && (
          <> Dimensions: {dimensions.map((d) => d.name).join(" × ")}.</>
        )}
      </p>

      {dimensions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addCombinations(visibleCombinations, "in this view")}
            disabled={visibleMissing === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gold text-on-gold hover:bg-gold-light disabled:opacity-40 transition-colors"
          >
            {visibleMissing === 0 ? "View complete" : `Add all in view (${visibleMissing})`}
          </button>

          {hasRest && (
            <button
              type="button"
              onClick={() => addCombinations(allCombinations, "across every dimension")}
              disabled={allMissing === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-light disabled:opacity-40 transition-colors"
            >
              {allMissing === 0
                ? `All ${allCombinations.length} combinations exist`
                : `Add every combination (${allMissing})`}
            </button>
          )}

          <button
            type="button"
            onClick={() => removeCombinations(visibleCombinations)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-primary/20 text-foreground hover:border-danger hover:text-danger transition-colors"
          >
            Remove all in view
          </button>

          <button
            type="button"
            onClick={applyPriceToAll}
            disabled={variants.length === 0 || Number.isNaN(parseFloat(basePrice))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-primary/20 text-foreground hover:border-gold hover:text-gold-deep disabled:opacity-40 transition-colors"
          >
            Apply this price to all {variants.length}
          </button>

          {fillNote && <span className="text-xs text-foreground/70">{fillNote}</span>}
        </div>
      )}

      {dimensions.length === 0 && (
        <p className="text-xs text-foreground/70">
          No variant dimensions configured. Add option dimensions above or create variants manually below.
        </p>
      )}

      {dimensions.length === 1 && d1 && (
        <div className="flex flex-wrap gap-1.5">
          {d1.values.map((value) => {
            const exists = existingMatrix.has(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleCell([value])}
                className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " + (
                  exists
                    ? "bg-gold-deep text-white"
                    : "bg-warm-sand/50 text-foreground hover:bg-warm-sand"
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
      )}

      {dimensions.length >= 2 && d1 && d2 && (
        <>
          {hasRest && (
            <div className="flex gap-3 flex-wrap bg-warm-sand/20 rounded-xl p-3">
              {rest.map((d, i) => (
                <div key={d.name}>
                  <label className="block text-[10px] font-medium text-foreground/80 mb-0.5">{d.name}</label>
                  <select
                    value={extraSelections[i] ?? d.values[0]}
                    onChange={(e) => setExtraSelections((prev) => ({ ...prev, [i]: e.target.value }))}
                    className="px-2 py-1.5 rounded-lg border border-primary/20 bg-white text-xs"
                  >
                    {d.values.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-1.5 text-left text-foreground/80 font-medium sticky left-0 bg-white z-10">
                  {d1.name} / {d2.name}
                </th>
                {d2.values.map((value) => (
                  <th key={value} className="p-1.5 text-center text-foreground font-medium whitespace-nowrap">
                    {value}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d1.values.map((rowValue) => (
                <tr key={rowValue}>
                  <td className="p-1.5 font-medium text-foreground sticky left-0 bg-white whitespace-nowrap">
                    {rowValue}
                  </td>
                  {d2.values.map((colValue) => {
                    const key = [rowValue, colValue, ...extraValues].join("|");
                    const exists = existingMatrix.has(key);
                    return (
                      <td key={colValue} className="p-0.5 text-center">
                        <button
                          onClick={() => toggleCell([rowValue, colValue, ...extraValues])}
                          className={"w-8 h-8 rounded-md transition-all text-[10px] font-medium " + (
                            exists
                              ? "bg-gold-deep text-white shadow-sm scale-105"
                              : "bg-warm-sand/30 text-foreground/70 hover:bg-warm-sand/50 hover:text-foreground/80"
                          )}
                          title={exists ? "Remove " + rowValue + " / " + colValue : "Add " + rowValue + " / " + colValue}
                        >
                          {exists ? "✓" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {hasRest && (
            <p className="text-[10px] text-foreground/70 mt-1">
              {rest.map((d) => d.name).join(" × ")} are picked above — the grid
              shows one combination of those values at a time.
            </p>
          )}
        </div>
        </>
      )}

      {variants.filter((v) => {
        if (v.options) {
          const key = dimensions.map((d) => v.options![d.name] ?? "").join("|");
          return !existingMatrix.has(key) || dimensions.length === 0;
        }
        const parts = v.name.split(" / ").map((p) => p.trim());
        return !(parts.length === dimensions.length && parts.every(Boolean));
      }).length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-foreground/80 mb-1">Custom variants (not in matrix):</p>
          <div className="space-y-1">
            {variants
              .filter((v) => {
                if (v.options) {
                  const key = dimensions.map((d) => v.options![d.name] ?? "").join("|");
                  return !existingMatrix.has(key) || dimensions.length === 0;
                }
                const parts = v.name.split(" / ").map((p) => p.trim());
                return !(parts.length === dimensions.length && parts.every(Boolean));
              })
              .map((v) => (
                <div key={v.id} className="flex items-center gap-2 text-xs bg-warm-sand/30 rounded-lg px-3 py-1.5">
                  <span className="flex-1">{v.name}</span>
                  <span className="text-gold-deep">${v.price.toFixed(2)}</span>
                  <button
                    onClick={() => onChange(variants.filter((x) => x.id !== v.id))}
                    className="text-danger hover:text-danger"
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
