import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import { SquareClient } from "square";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StorageBucket = any;

export interface CompositeProduct {
  id: string;
  name: string;
  description: string;
  categoryIds: string[];
  brand: string;
  colors: string[];
  tags: string[];
  images: string[];
  minPrice: number;
  maxPrice: number;
  variantGroups: VariantGroup[];
  updatedAt: string;
  syncedAt: string;
  itemCount: number;
}

export interface VariantGroup {
  name: string;
  options: VariantOption[];
}

export interface VariantOption {
  label: string;
  sku: string;
  price: number;
  squareItemId: string;
  squareVariationId: string;
}

export interface SyncResult {
  success: boolean;
  products: number;
  categories: number;
  items: number;
  errors: string[];
}

export interface SyncStatus {
  lastSync: string | null;
  productCount: number;
  categoryCount: number;
  itemCount: number;
  errors: string[];
}

interface SquareRawItem {
  type: string;
  id: string;
  itemData?: {
    name: string;
    description?: string;
    imageIds?: string[];
    categories?: { id: string }[];
    ecom_visibility?: string;
    variations?: SquareRawVariation[];
  };
}

interface SquareRawVariation {
  id: string;
  type: string;
  itemVariationData?: {
    itemId: string;
    name: string;
    sku?: string;
    priceMoney?: { amount: bigint | number; currency: string };
  };
}

interface SquareRawImage {
  id: string;
  type: string;
  imageData?: { id?: string; url?: string; name?: string };
}

interface SquareRawCategory {
  id: string;
  type: string;
  categoryData?: { name?: string };
}

interface FlattenedVariation {
  itemId: string;
  itemName: string;
  itemDescription: string;
  variationId: string;
  variationName: string;
  price: number;
  sku: string;
  categoryIds: string[];
  imageUrl: string | null;
}

const SIZE_PATTERNS = [
  /\b(?:Youth )?(?:X-?Small|XS)\b/i,
  /\bSmall\b/i,
  /\bMedium\b/i,
  /\bLarge\b/i,
  /\b(?:X-?Large|XL)\b/i,
  /\b(?:2 ?X-?L(?:arge)?|XXL)\b/i,
  /\b(?:3 ?X-?L(?:arge)?|XXXL)\b/i,
  /\b(?:4 ?X-?L(?:arge)?|XXXXL)\b/i,
  /\bOne Size\b/i,
  /\bStandard\b/i,
  /\bTall\b/i,
  /\bShort\b/i,
  /\bYouth\b/i,
  /(?:(\d+)"|(\d+)\s*['\u2019]\s*(\d+)?["\u201D]?)/,
];

const COLOR_PATTERNS: [RegExp, string][] = [
  [/\bBlack\b/i, "black"],
  [/\bWhite\b/i, "white"],
  [/\bGray|Grey\b/i, "gray"],
  [/\bNavy\b/i, "navy"],
  [/\bBlue\b/i, "blue"],
  [/\bRed\b/i, "red"],
  [/\bGreen\b/i, "green"],
  [/\bSage\b/i, "sage"],
  [/\bPurple\b/i, "purple"],
  [/\bPink\b/i, "pink"],
  [/\bOrange\b/i, "orange"],
  [/\bYellow\b/i, "yellow"],
  [/\bBrown\b/i, "brown"],
  [/\bTan\b/i, "tan"],
  [/\bCream\b/i, "cream"],
  [/\bHeather\b/i, "heather"],
  [/\bCharcoal\b/i, "charcoal"],
  [/\bAsh\b/i, "ash"],
  [/\bMaroon\b/i, "maroon"],
  [/\bTeal\b/i, "teal"],
  [/\bBurgundy\b/i, "burgundy"],
  [/\bRoyal\b/i, "royal"],
  [/\bNeon\b/i, "neon"],
];

function extractColors(name: string): string[] {
  const found = new Set<string>();
  for (const [pattern, label] of COLOR_PATTERNS) {
    if (pattern.test(name)) {
      found.add(label);
    }
  }
  return [...found];
}

function extractSizes(name: string): string | null {
  for (const pattern of SIZE_PATTERNS) {
    const match = name.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

function extractTags(name: string, description: string, categories: string[]): string[] {
  const combined = `${name} ${description} ${categories.join(" ")}`.toLowerCase();
  const tags = new Set<string>();

  const typePatterns: [RegExp, string][] = [
    [/\btee|t-shirt|t shirt\b/i, "t-shirt"],
    [/\bhoodie|hooded\b/i, "hoodie"],
    [/\btank\b/i, "tank"],
    [/\bjacket\b/i, "jacket"],
    [/\bhat|capped\b/i, "hat"],
    [/\bsticker|slap|decal\b/i, "sticker"],
    [/\bornament\b/i, "ornament"],
    [/\bjewelry|pendant|necklace\b/i, "jewelry"],
    [/\bwood|sign|plaque\b/i, "wood"],
    [/\bglass|cutting board\b/i, "glass"],
    [/\bpet|dog|cat|scarf\b/i, "pet"],
    [/\bdrink|koozie|hugger|can cooler\b/i, "drink"],
    [/\bcoaster\b/i, "coaster"],
    [/\bbag|tote\b/i, "bag"],
  ];

  for (const [pattern, tag] of typePatterns) {
    if (pattern.test(combined)) tags.add(tag);
  }

  const words = name.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
  for (const word of words) {
    if (/^(?!the|and|for|with|our|new|set|pack|custom)$/.test(word)) {
      tags.add(word);
    }
  }

  return [...tags];
}

function normalizeName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/["\u201C\u201D]/g, '"')
    .replace(/['\u2018\u2019]/g, "'")
    .trim();
}

function groupByBrand(items: FlattenedVariation[]): Map<string, FlattenedVariation[]> {
  const brands = new Map<string, FlattenedVariation[]>();

  for (const item of items) {
    const name = item.itemName.toLowerCase();
    let brandKey = "Other";

    const brandPatterns: [RegExp, string][] = [
      [/\bbiscuit hockey\b/i, "Biscuit Hockey"],
      [/\bi.?m ok r u\b/i, "I'M OK R U"],
      [/\bdurango lacrosse\b/i, "Durango Lacrosse"],
      [/\bdurango hockey\b/i, "Durango Hockey"],
      [/\bdurango high school alpine ski\b/i, "Durango Alpine Ski"],
      [/\bdurango roller girls\b/i, "Durango Roller Girls"],
      [/\bdunphy\b/i, "Dunphy Stock FAM"],
      [/\bgreen buddh?a\b/i, "GREEN BUDDHA"],
      [/\blittle stranger\b/i, "LITTLE STRANGER"],
      [/\bjordan branch\b/i, "Jordan Branch Music"],
      [/\bet art\b/i, "ET Art"],
      [/\bwomen in aviation\b/i, "Women In Aviation"],
      [/\bfly high\b/i, "Fly High AA"],
      [/\bcustom slap\b/i, "Custom Slaps"],
      [/\bjewelry\b/i, "Jewelry"],
      [/\bwood sign|chromaluxe wood\b/i, "Wood Signs"],
      [/\bpet scarf\b/i, "Pet Scarves"],
      [/\bornament\b/i, "Ornaments"],
      [/\bglass cutting board\b/i, "Glass Cutting Boards"],
      [/\bdrink hugger|neoprene\b/i, "Drink Huggers"],
      [/\bhat\b/i, "Hats"],
    ];

    for (const [pattern, label] of brandPatterns) {
      if (pattern.test(name)) {
        brandKey = label;
        break;
      }
    }

    if (!brands.has(brandKey)) {
      brands.set(brandKey, []);
    }
    brands.get(brandKey)!.push(item);
  }

  return brands;
}

function buildCompositeProduct(
  brand: string,
  members: FlattenedVariation[]
): CompositeProduct {
  const first = members[0];
  const itemIds = [...new Set(members.map((m) => m.itemId))];

  const groups = new Map<string, VariantGroup>();
  const sizes = new Map<string, VariantOption[]>();
  const colors = new Set<string>();

  for (const m of members) {
    const c = extractColors(m.variationName);
    c.forEach((col) => colors.add(col));

    const size = extractSizes(m.variationName);
    const key = size ?? "Standard";

    if (!sizes.has(key)) sizes.set(key, []);
    sizes.get(key)!.push({
      label: m.variationName || key,
      sku: m.sku ?? "",
      price: m.price,
      squareItemId: m.itemId,
      squareVariationId: m.variationId,
    });
  }

  if (sizes.size > 1) {
    const options = [...sizes.entries()].map(([sizeLabel, opts]) => {
      const cheapest = opts.reduce((a, b) => (a.price < b.price ? a : b));
      return { label: sizeLabel, sku: cheapest.sku, price: cheapest.price, squareItemId: cheapest.squareItemId, squareVariationId: cheapest.squareVariationId };
    });
    groups.set("Size", { name: "Size", options });
  } else if (members.length > 1) {
    const options = members.map((m) => ({
      label: m.variationName,
      sku: m.sku ?? "",
      price: m.price,
      squareItemId: m.itemId,
      squareVariationId: m.variationId,
    }));
    groups.set("Option", { name: "Option", options });
  }

  const prices = members.map((m) => m.price).filter((p) => p > 0);
  const allColors = [...colors];
  const allImages = [...new Set(members.map((m) => m.imageUrl).filter(Boolean))] as string[];

  return {
    id: `comp_${brand.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`,
    name: normalizeName(first.itemName),
    description: (first.itemDescription ?? "").substring(0, 600),
    categoryIds: [...new Set(members.flatMap((m) => m.categoryIds))],
    brand,
    colors: allColors,
    tags: extractTags(first.itemName, first.itemDescription ?? "", []),
    images: allImages,
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
    variantGroups: [...groups.values()],
    updatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    itemCount: itemIds.length,
  };
}

export async function syncProductsFromSquare(
  client: SquareClient,
  db: ReturnType<typeof getFirestore>
): Promise<SyncResult> {
  const errors: string[] = [];

  logger.info("Fetching Square catalog...");
  const itemResponse = await client.catalog.search({
    objectTypes: ["ITEM"],
    includeRelatedObjects: true,
  });

  const rawItems = ((itemResponse.objects ?? []) as SquareRawItem[]).filter(
    (o) => o.itemData?.ecom_visibility === "VISIBLE"
  );

  const relatedObjects = (itemResponse as Record<string, unknown>).relatedObjects as
    | SquareRawItem[]
    | undefined;
  const related = relatedObjects ?? [];
  const images = related.filter(
    (o) => o.type === "IMAGE"
  ) as unknown as SquareRawImage[];

  const imageMap = new Map<string, string>();
  for (const img of images) {
    const id = img.imageData?.id;
    const url = img.imageData?.url;
    if (id && url) imageMap.set(id, url);
  }

  const flatVariations: FlattenedVariation[] = [];
  for (const item of rawItems) {
    const data = item.itemData;
    if (!data?.variations?.length) continue;

    const itemImages = (data.imageIds ?? [])
      .map((id) => imageMap.get(String(id)))
      .filter(Boolean) as string[];

    for (const v of data.variations) {
      const vd = v.itemVariationData;
      const rawAmount = vd?.priceMoney?.amount;
      const amount =
        typeof rawAmount === "bigint"
          ? Number(rawAmount)
          : (rawAmount ?? 0);
      const price = amount / 100;

      if (price < 0.01) continue;

      flatVariations.push({
        itemId: item.id,
        itemName: data.name ?? "",
        itemDescription: data.description ?? "",
        variationId: v.id,
        variationName: vd?.name ?? "",
        price,
        sku: vd?.sku ?? "",
        categoryIds: (data.categories ?? []).map((c) => c.id),
        imageUrl: itemImages[0] ?? null,
      });
    }
  }

  const categoriesResponse = await client.catalog.search({
    objectTypes: ["CATEGORY"],
  });
  const rawCategories = (categoriesResponse.objects ?? []) as SquareRawCategory[];
  const categories = rawCategories.map((c) => ({
    id: c.id,
    name: c.categoryData?.name ?? c.id,
  }));

  const brands = groupByBrand(flatVariations);

  const compositeProducts: CompositeProduct[] = [];
  for (const [brand, members] of brands) {
    if (members.length === 0) continue;
    compositeProducts.push(buildCompositeProduct(brand, members));
  }

  logger.info("Writing to Firestore...");
  const batch = db.batch();
  const productsRef = db.collection("products");
  const categoriesRef = db.collection("categories");

  for (const cat of categories) {
    batch.set(categoriesRef.doc(cat.id), {
      name: cat.name,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  for (const product of compositeProducts) {
    batch.set(productsRef.doc(product.id), product);
  }

  await batch.commit();

  await db.collection("config").doc("sync_status").set({
    lastSync: new Date().toISOString(),
    productCount: compositeProducts.length,
    categoryCount: categories.length,
    itemCount: flatVariations.length,
    errors,
  }, { merge: true });

  logger.info("Sync complete", {
    products: compositeProducts.length,
    categories: categories.length,
    items: flatVariations.length,
    errors: errors.length,
  });

  return {
    success: true,
    products: compositeProducts.length,
    categories: categories.length,
    items: flatVariations.length,
    errors,
  };
}

export async function getSyncStatus(
  db: ReturnType<typeof getFirestore>
): Promise<SyncStatus> {
  const snap = await db.collection("config").doc("sync_status").get();
  const data = snap.data() ?? {};
  return {
    lastSync: (data.lastSync as string) ?? null,
    productCount: (data.productCount as number) ?? 0,
    categoryCount: (data.categoryCount as number) ?? 0,
    itemCount: (data.itemCount as number) ?? 0,
    errors: (data.errors as string[]) ?? [],
  };
}

// ─── Import from Square with Images ───────────────────────────────

async function downloadImage(url: string, bucket: StorageBucket): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const filename = `products/square-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const file = bucket.file(filename);
    await file.save(Buffer.from(buffer), { contentType: "image/jpeg" });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${filename}`;
  } catch {
    return null;
  }
}

export async function importFromSquare(
  client: SquareClient,
  db: ReturnType<typeof getFirestore>,
  storageBucket: StorageBucket
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];

  const itemResponse = await client.catalog.search({
    objectTypes: ["ITEM"],
    includeRelatedObjects: true,
  });

  const rawItems = ((itemResponse.objects || []) as unknown[]).filter((o) => {
    const raw = o as Record<string, unknown>;
    const data = raw.itemData as Record<string, unknown> | undefined;
    return data?.ecom_visibility === "VISIBLE";
  }) as Array<Record<string, unknown>>;

  const related = (itemResponse as Record<string, unknown>).relatedObjects as Array<Record<string, unknown>> | undefined;
  const relatedImages = (related ?? []).filter((o) => o.type === "IMAGE") as Array<Record<string, unknown>>;

  const imageMap = new Map<string, string>();
  for (const img of relatedImages) {
    const id = (img.imageData as Record<string, string> | undefined)?.id;
    const url = (img.imageData as Record<string, string> | undefined)?.url;
    if (id && url) imageMap.set(id, url);
  }

  const categoriesResponse = await client.catalog.search({ objectTypes: ["CATEGORY"] });
  const rawCategories = (categoriesResponse.objects ?? []) as unknown as Array<Record<string, unknown>>;
  const catMap = new Map<string, string>();
  for (const c of rawCategories) {
    const cd = c.categoryData as Record<string, string> | undefined;
    if (cd?.name) catMap.set(c.id as string, cd.name);
  }

  const brands = new Map<string, Array<Record<string, unknown>>>();
  for (const item of rawItems) {
    const data = (item.itemData || {}) as Record<string, unknown>;
    const cats = (data.categories || []) as Array<{ id: string }>;
    let brand = "Other";
    for (const cat of cats) {
      const name = catMap.get(cat.id) ?? "";
      if (name) { brand = name; break; }
    }
    if (!brands.has(brand)) brands.set(brand, []);
    brands.get(brand)!.push(item);
  }

  const batch = db.batch();
  const productsRef = db.collection("products");
  const categoriesRef = db.collection("categories");
  let imported = 0;

  for (const [brand, items] of brands) {
    const brandId = `cat_${brand.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    batch.set(categoriesRef.doc(brandId), {
      id: brandId,
      name: brand,
      slug: brand.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      order: imported,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    for (const item of items) {
      const data = (item.itemData || {}) as Record<string, unknown>;
      const variations = (data.variations || []) as Array<Record<string, unknown>>;
      const name = (data.name as string) ?? "";
      const description = (data.description as string) ?? "";

      const itemImageIds = ((data.imageIds || []) as string[]).map(String);
      const primaryImageUrl = itemImageIds
        .map((id) => imageMap.get(id))
        .find(Boolean) ?? null;

      let storageUrl = "";
      if (primaryImageUrl) {
        const downloaded = await downloadImage(primaryImageUrl, storageBucket);
        if (downloaded) storageUrl = downloaded;
      }

      const productId = `prod_${imported}_${Date.now()}`;
      const variants = variations
        .filter((v) => {
          const vd = (v.itemVariationData || {}) as Record<string, unknown>;
          const pm = vd.priceMoney as { amount?: bigint } | undefined;
          return pm?.amount ? Number(pm.amount) >= 200 : false;
        })
        .map((v) => {
          const vd = (v.itemVariationData || {}) as Record<string, unknown>;
          const pm = vd.priceMoney as { amount?: bigint } | undefined;
          return {
            id: (v.id as string) ?? "",
            name: (vd.name as string) ?? "",
            price: pm?.amount ? Number(pm.amount) / 100 : 0,
            sku: (vd.sku as string) ?? "",
          };
        });

      if (variants.length === 0) continue;

      const tags = name.toLowerCase().match(/\b[a-z]{3,}\b/g)?.filter(
        (w) => !["the", "and", "for", "with"].includes(w)
      ) ?? [];

      batch.set(productsRef.doc(productId), {
        id: productId,
        name,
        description: description.substring(0, 600),
        categoryId: brandId,
        colors: [],
        tags: [...new Set([brand.toLowerCase(), ...tags])],
        images: storageUrl ? [storageUrl] : [],
        variants,
        active: true,
        featured: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      imported++;
    }
  }

  await batch.commit();

  await db.collection("config").doc("import_status").set({
    lastImport: new Date().toISOString(),
    imported,
    errors,
  }, { merge: true });

  return { imported, errors };
}
