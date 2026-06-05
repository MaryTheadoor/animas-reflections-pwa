"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SquareCatalogItem } from "@/types";
import { getProductImageUrl } from "@/hooks/useCatalog";

interface ProductDetailProps {
  item: SquareCatalogItem;
  onClose: () => void;
}

export default function ProductDetail({ item, onClose }: ProductDetailProps) {
  const [selectedVariation, setSelectedVariation] = useState(item.variations[0]);
  const imageUrl = getProductImageUrl(item);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-elevated max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white/90 rounded-full p-2 text-teal/50 hover:text-teal transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative aspect-square bg-warm-sand rounded-t-2xl overflow-hidden">
          <Image src={imageUrl} alt={item.name} fill className="object-cover" />
        </div>

        <div className="p-6">
          <h2 className="text-2xl font-bold font-display mb-2">{item.name}</h2>
          {item.description && (
            <div
              className="text-teal/60 mb-4 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: item.description }}
            />
          )}

          {item.variations.length > 1 && (
            <div className="mb-4">
              <span className="text-sm font-medium text-teal block mb-2">Options</span>
              <div className="flex flex-wrap gap-2">
                {item.variations.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariation(v)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedVariation.id === v.id
                        ? "bg-teal text-white btn-tactile btn-teal-tactile"
                        : "bg-warm-sand text-teal/60 hover:bg-warm-sand/80"
                    }`}
                  >
                    {v.name || "Standard"}
                    {v.price > 0 && (
                      <span className="ml-1 opacity-70">— ${v.price.toFixed(2)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-3xl font-bold text-gold mb-6">
            ${selectedVariation.price.toFixed(2)}
          </p>

          <div className="flex gap-3">
            <Link
              href={`/customizer?product=${item.id}&variation=${selectedVariation.id}`}
              onClick={onClose}
              className="flex-1 text-center py-3 rounded-xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
            >
              Customize &amp; Order
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
