import Image from "next/image";

/**
 * The little artwork swatch shown beside a modifier option that has a picture —
 * an assigned modifier background or a design matched by name. Renders nothing
 * when there is no image, so callers can drop it in unconditionally.
 */
export default function ModifierThumb({ src, size = 22 }: { src?: string; size?: number }) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="rounded object-cover shrink-0 bg-white/40"
    />
  );
}
