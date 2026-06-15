"use client";

import Image from "next/image";
import Link from "next/link";
import type { SquareCatalogItem } from "@/types";
import { getProductImageUrl } from "@/hooks/useCatalog";

interface ProductCardProps {
  item: SquareCatalogItem;
}

export default function ProductCard({ item }: ProductCardProps) {
  const minPrice = Math.min(...item.variations.map((v) => v.price));
  const imageUrl = getProductImageUrl(item);

  return (
    <Link
      href={`/product?id=${item.id}`}
      className="tile-sites text-left w-full group cursor-pointer block"
    >
      <div className="relative aspect-square bg-warm-sand rounded-xl overflow-hidden mb-4">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-warm-sand to-primary/5">
            <span className="text-4xl font-bold text-primary/15 font-display select-none">
              {item.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {item.variations.length > 1 && (
          <span className="absolute top-3 left-3 bg-primary text-white text-xs px-2 py-1 rounded-full shadow-sm">
            {item.variations.length} variants
          </span>
        )}
      </div>

      <h3 className="font-bold text-primary text-sm leading-snug line-clamp-2 mb-1 group-hover:text-gold transition-colors">
        {item.name}
      </h3>

      {item.description && (
        <p className="text-xs text-primary/40 line-clamp-2 mb-3 leading-relaxed">
          {item.description.replace(/<[^>]*>/g, "").substring(0, 120)}
        </p>
      )}

      <div className="flex items-end justify-between mt-auto pt-3 border-t border-warm-sand/50">
        <p className="text-gold font-bold text-lg leading-none">
          {item.variations.length === 1 && item.variations[0].price > 0
            ? `$${item.variations[0].price.toFixed(2)}`
            : `Starting at $${minPrice.toFixed(2)}`}
        </p>
        <span className="text-xs font-semibold text-gold bg-gold/10 px-3 py-1.5 rounded-full group-hover:bg-gold group-hover:text-white transition-colors">
          View Product
        </span>
      </div>
      {/* Stock indicator */}
      {(() => {
        const totalStock = item.variations?.reduce((sum, v) => sum + (v.inventory ?? 0), 0) ?? 0;
        const hasInventory = item.variations?.some((v) => v.inventory !== undefined);
        if (!hasInventory) return null;
        if (totalStock === 0) return (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full shadow-sm">Out of stock</span>
        );
        if (totalStock <= 3) return (
          <span className="absolute top-3 right-3 bg-gold text-white text-xs px-2 py-0.5 rounded-full shadow-sm">Only ${totalStock} left</span>
        );
        if (totalStock <= 10) return (
          <span className="absolute top-3 right-3 bg-teal/80 text-white text-xs px-2 py-0.5 rounded-full shadow-sm">${totalStock} in stock</span>
        );
        return null;
      })()}
    </Link>
  );
}
