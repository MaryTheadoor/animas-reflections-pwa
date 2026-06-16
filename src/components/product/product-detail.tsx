"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ManagedProduct } from "@/types";
import { getProductImageUrl } from "@/hooks/useCatalog";

interface ProductDetailProps {
  product: ManagedProduct;
  onClose: () => void;
}

export default function ProductDetail({ product, onClose }: ProductDetailProps) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const imageUrl = getProductImageUrl(product);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-float max-w-lg w-full max-h-[92vh] overflow-hidden flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-white/90 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center text-primary/50 hover:text-primary transition-colors shadow-sm"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image — constrained height */}
        <div className="relative w-full h-48 sm:h-64 bg-warm-sand shrink-0">
          <Image src={imageUrl} alt={product.name} fill className="object-contain" sizes="400px" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-4 sm:p-6 flex-1">
          <h2 className="text-lg sm:text-xl font-bold font-display mb-1">{product.name}</h2>
          {product.description && (
            <p className="text-sm text-primary/60 mb-4 leading-relaxed line-clamp-4">
              {product.description.replace(/<[^>]*>/g, " ").substring(0, 300)}
            </p>
          )}

          {product.variants.length > 1 && (
            <div className="mb-4">
              <span className="text-xs font-medium text-primary block mb-2">Options</span>
              <div className="flex flex-wrap gap-1.5">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      selectedVariant.id === v.id
                        ? "bg-primary text-white btn-tactile btn-primary-tactile"
                        : "bg-warm-sand text-primary/60 hover:bg-warm-sand/80"
                    }`}
                  >
                    {v.name || "Standard"}
                    {v.price > 0 && (
                      <span className="ml-1 opacity-70">${v.price.toFixed(2)}</span>
                    )}
                    {v.inventory !== undefined && v.inventory <= 3 && (
                      <span className={"ml-1 text-xs " + (v.inventory === 0 ? "text-red-400" : "text-gold")}>
                        {v.inventory === 0 ? "(sold out)" : ("(only " + v.inventory + " left)")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-2xl font-bold text-gold mb-4">
            ${selectedVariant.price.toFixed(2)}
          </p>

          <Link
            href={`/customizer?product=${product.id}&variant=${selectedVariant.id}`}
            onClick={onClose}
            className="block w-full text-center py-2.5 rounded-xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile text-sm"
          >
            Customize &amp; Order
          </Link>
        </div>
      </div>
    </div>
  );
}
