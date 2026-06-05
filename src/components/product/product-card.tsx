"use client";

import Image from "next/image";
import type { SquareCatalogItem } from "@/types";
import { getProductImageUrl } from "@/hooks/useCatalog";

interface ProductCardProps {
  item: SquareCatalogItem;
  onSelect?: (item: SquareCatalogItem) => void;
}

export default function ProductCard({ item, onSelect }: ProductCardProps) {
  const minPrice = Math.min(...item.variations.map((v) => v.price));
  const imageUrl = getProductImageUrl(item);

  return (
    <button
      onClick={() => onSelect?.(item)}
      className="tile-sites text-left w-full group cursor-pointer"
    >
      <div className="relative aspect-square bg-warm-sand rounded-xl overflow-hidden mb-4">
        <Image
          src={imageUrl}
          alt={item.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {item.variations.length > 1 && (
          <span className="absolute top-3 left-3 bg-teal text-white text-xs px-2 py-1 rounded-full shadow-sm">
            {item.variations.length} variants
          </span>
        )}
      </div>

      <h3 className="font-bold text-teal text-sm leading-snug line-clamp-2 mb-1 group-hover:text-gold transition-colors">
        {item.name}
      </h3>

      {item.description && (
        <p
          className="text-xs text-teal/40 line-clamp-2 mb-3 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: item.description.replace(/<[^>]*>/g, "").substring(0, 120),
          }}
        />
      )}

      <div className="flex items-end justify-between mt-auto pt-3 border-t border-warm-sand/50">
        <p className="text-gold font-bold text-lg leading-none">
          {item.variations.length === 1 && item.variations[0].price > 0
            ? `$${item.variations[0].price.toFixed(2)}`
            : `From $${minPrice.toFixed(2)}`}
        </p>
        <span className="text-xs text-teal/30 font-medium">Customize &rarr;</span>
      </div>
    </button>
  );
}
