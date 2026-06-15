"use client";

import { useState, useMemo } from "react";
import type { ManagedVariant } from "@/types";
import { PRODUCT_SIZES, PRODUCT_COLORS } from "@/lib/constants";

interface VariantMatrixEditorProps {
  variants: ManagedVariant[];
  onChange: (variants: ManagedVariant[]) => void;
}

export default function VariantMatrixEditor({ variants, onChange }: VariantMatrixEditorProps) {
  const existingMatrix = useMemo(() => {
    const matrix = new Map<string, ManagedVariant>();
    variants.forEach((v) => {
      const parts = v.name.split(" / ");
      if (parts.length === 2) {
        matrix.set(parts[0].trim() + "|" + parts[1].trim(), v);
      }
    });
    return matrix;
  }, [variants]);

  const [basePrice, setBasePrice] = useState(() => {
    const first = variants[0];
    return first?.price ? String(first.price) : "";
  });
  const [baseSku, setBaseSku] = useState("");

  const toggleCell = (size: string, color: string) => {
    const key = size + "|" + color;
    const existing = existingMatrix.get(key);

    if (existing) {
      onChange(variants.filter((v) => v.id !== existing.id));
    } else {
      const price = parseFloat(basePrice) || 0;
      const skuPrefix = baseSku.trim();
      const newVariant: ManagedVariant = {
        id: crypto.randomUUID(),
        name: size + " / " + color,
        price,
        sku: skuPrefix ? skuPrefix + "-" + size + "-" + color.substring(0, 3).toUpperCase() : "",
      };
      onChange([...variants, newVariant]);
    }
  };

  const sizes = [...PRODUCT_SIZES] as readonly string[];
  const colors = [...PRODUCT_COLORS] as readonly string[];

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

      <p className="text-xs text-primary/40">
        Click cells to toggle variants. {variants.length} variant(s) selected.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-primary/40 font-medium sticky left-0 bg-white z-10">Size / Color</th>
              {colors.map((color) => (
                <th key={color} className="p-1.5 text-center text-primary/50 font-medium whitespace-nowrap">
                  {color}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) => (
              <tr key={size}>
                <td className="p-1.5 font-medium text-primary/60 sticky left-0 bg-white whitespace-nowrap">
                  {size}
                </td>
                {colors.map((color) => {
                  const key = size + "|" + color;
                  const exists = existingMatrix.has(key);
                  return (
                    <td key={color} className="p-0.5 text-center">
                      <button
                        onClick={() => toggleCell(size, color)}
                        className={"w-8 h-8 rounded-md transition-all text-[10px] font-medium " + (
                          exists
                            ? "bg-gold text-white shadow-sm scale-105"
                            : "bg-warm-sand/30 text-primary/20 hover:bg-warm-sand/50 hover:text-primary/40"
                        )}
                        title={exists ? "Remove " + size + " / " + color : "Add " + size + " / " + color}
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
      </div>

      {variants.filter((v) => !v.name.includes(" / ")).length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-primary/40 mb-1">Custom variants (not in matrix):</p>
          <div className="space-y-1">
            {variants
              .filter((v) => !v.name.includes(" / "))
              .map((v) => (
                <div key={v.id} className="flex items-center gap-2 text-xs bg-warm-sand/30 rounded-lg px-3 py-1.5">
                  <span className="flex-1">{v.name}</span>
                  <span className="text-gold">${v.price.toFixed(2)}</span>
                  <button
                    onClick={() => onChange(variants.filter((x) => x.id !== v.id))}
                    className="text-red-400 hover:text-red-600"
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
