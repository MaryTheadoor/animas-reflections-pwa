import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { SquareClient } from "square";

// ─── ManagedProduct is the canonical product format ──────────────
// Both the admin UI and the frontend catalog read this format from Firestore.

export interface ManagedProduct {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  productType: string;
  colors: string[];
  tags: string[];
  images: string[];
  variants: ManagedVariant[];
  active: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  squareItemIds?: string[];
  seoTitle?: string;
  seoDescription?: string;
  printZones?: {
    front: { x_percent: number; y_percent: number; width_percent: number; height_percent: number };
    back?: { x_percent: number; y_percent: number; width_percent: number; height_percent: number };
    sleeve?: { x_percent: number; y_percent: number; width_percent: number; height_percent: number };
  };
  weightOz?: number;
  baseProductId?: string;
}

export interface ManagedVariant {
  id: string;
  name: string;
  price: number;
  sku: string;
  squareItemId?: string;
  squareVariationId?: string;
  inventory?: number;
}

export interface ManagedCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
  createdAt: string;
  updatedAt: string;
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

// ─── Brand Detection ─────────────────────────────────────────────

const BRAND_PATTERNS: [RegExp, string][] = [
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
  [/\banimas reflections\b/i, "Animas Reflections"],
];

function detectBrand(name: string): string {
  for (const [pattern, label] of BRAND_PATTERNS) {
    if (pattern.test(name)) return label;
  }
  return "Animas Reflections";
}

function getBrandCategoryName(brand: string): string {
  // Map brands to standard categories
  const categoryMap: Record<string, string> = {
    "Biscuit Hockey": "Biscuit Hockey",
    "I'M OK R U": "I'M OK R U",
    "Durango Lacrosse": "Durango Lacrosse",
    "Durango Hockey": "Durango Hockey",
    "Durango Alpine Ski": "Durango Alpine Ski",
    "Durango Roller Girls": "Durango Roller Girls",
    "Dunphy Stock FAM": "Dunphy Stock FAM",
    "GREEN BUDDHA": "GREEN BUDDHA",
    "LITTLE STRANGER": "LITTLE STRANGER",
    "Jordan Branch Music": "Jordan Branch Music",
    "ET Art": "ET Art",
    "Women In Aviation": "Women In Aviation",
    "Fly High AA": "Fly High AA",
    "Custom Slaps": "Custom Slaps",
    "Jewelry": "Jewelry",
    "Wood Signs": "Wood Signs",
    "Pet Scarves": "Pet Scarves",
    "Ornaments": "Ornaments",
    "Glass Cutting Boards": "Glass Cutting Boards",
    "Drink Huggers": "Drink Huggers",
    "Hats": "Hats",
    "Animas Reflections": "Animas Reflections",
  };
  return categoryMap[brand] ?? brand;
}

// ─── Build ManagedProduct from grouped variations ────────────────

function detectProductType(brand: string, tags: string[]): string {
  const lower = `${brand} ${tags.join(" ")}`.toLowerCase();
  if (/sticker|slap|decal/i.test(lower)) return "sticker";
  if (/sign|wood/i.test(lower)) return "sign";
  if (/jewelry|necklace|bracelet|earring/i.test(lower)) return "jewelry";
  if (/hat|bag|scarf|drink|hugger|ornament|cutting|board|pet/i.test(lower)) return "accessory";
  if (/shirt|hoodie|sweat|tank|tee|apparel|long.?sleeve|crewneck/i.test(lower)) return "apparel";
  return "other";
}

function buildManagedProduct(
  brand: string,
  members: FlattenedVariation[]
): ManagedProduct {
  const now = new Date().toISOString();
  const first = members[0];

  // Collect all unique data
  const allColors = new Set<string>();
  const allTags = new Set<string>();
  const allImages = new Set<string>();
  const squareItemIds: string[] = [];
  const variantMap = new Map<string, ManagedVariant>();

  for (const m of members) {
    extractColors(m.variationName).forEach((c) => allColors.add(c));
    extractTags(m.itemName, m.itemDescription ?? "", m.categoryIds).forEach((t) => allTags.add(t));
    if (m.imageUrl) allImages.add(m.imageUrl);
    if (!squareItemIds.includes(m.itemId)) squareItemIds.push(m.itemId);

    // Build variant — prefer size+color formatted name, fall back to variation name
    const size = extractSizes(m.variationName);
    const colors = extractColors(m.variationName);
    const variantName = [size, ...colors].filter(Boolean).join(" ") || m.variationName || "Standard";

    // Use variation ID as variant key (dedupe by variation)
    const key = m.variationId;
    if (!variantMap.has(key)) {
      variantMap.set(key, {
        id: m.variationId,
        name: variantName,
        price: m.price,
        sku: m.sku ?? "",
        squareItemId: m.itemId,
        squareVariationId: m.variationId,
      });
    }
  }

  const brandSlug = brand.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const categoryId = `cat_${brandSlug}`;

  return {
    id: `prod_${brandSlug}_${Date.now()}`,
    name: brand,
    description: (first.itemDescription ?? `Custom ${brand} merchandise. Professionally printed in Durango, CO.`).substring(0, 600),
    categoryId,
    productType: detectProductType(brand, [...allTags]),
    colors: [...allColors],
    tags: [brand.toLowerCase(), ...allTags],
    images: [...allImages],
    variants: [...variantMap.values()],
    active: true,
    featured: false,
    createdAt: now,
    updatedAt: now,
    squareItemIds,
  };
}

// ─── Image Download Helper ───────────────────────────────────────

async function downloadSquareImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bucket = getStorage().bucket();
    const filename = `products/square-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const file = bucket.file(filename);
    await file.save(Buffer.from(buffer), { contentType: "image/jpeg" });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${filename}`;
  } catch {
    return null;
  }
}

// ─── Main Sync: Square → Firestore (ManagedProduct format) ───────

export async function syncProductsFromSquare(
  client: SquareClient,
  db: ReturnType<typeof getFirestore>
): Promise<SyncResult> {
  const errors: string[] = [];
  const now = new Date().toISOString();

  logger.info("Fetching Square catalog...");

  // Fetch all ITEMs with related IMAGE objects
  let allRawItems: SquareRawItem[] = [];
  let allRelatedImages: SquareRawImage[] = [];
  let cursor: string | undefined;

  do {
    const itemResponse = await client.catalog.search({
      objectTypes: ["ITEM"],
      includeRelatedObjects: true,
      limit: 1000,
      cursor,
    });

    const pageItems = ((itemResponse.objects ?? []) as SquareRawItem[]).filter(
      (o) => o.itemData?.ecom_visibility === "VISIBLE"
    );
    allRawItems = allRawItems.concat(pageItems);

    const relatedObjects = (itemResponse as Record<string, unknown>).relatedObjects as SquareRawItem[] | undefined;
    const pageImages = (relatedObjects ?? []).filter(
      (o) => o.type === "IMAGE"
    ) as unknown as SquareRawImage[];
    allRelatedImages = allRelatedImages.concat(pageImages);

    cursor = (itemResponse as Record<string, unknown>).cursor as string | undefined;
  } while (cursor);

  logger.info("Square catalog fetched", {
    totalItems: allRawItems.length,
    relatedImages: allRelatedImages.length,
  });

  // Build image lookup map
  const imageMap = new Map<string, string>();
  for (const img of allRelatedImages) {
    const id = img.imageData?.id;
    const url = img.imageData?.url;
    if (id && url) imageMap.set(String(id), url);
  }
  logger.info("Image map ready", { size: imageMap.size });

  // Flatten items → variations, grouped by detected brand
  const flatVariations: FlattenedVariation[] = [];

  for (const item of allRawItems) {
    const data = item.itemData;
    if (!data?.name || !data?.variations?.length) continue;

    const itemImageIds = (data.imageIds ?? []).map(String);
    const primaryImageUrl = itemImageIds
      .map((id) => imageMap.get(id))
      .find(Boolean) ?? null;

    for (const v of data.variations) {
      const vd = v.itemVariationData;
      if (!vd) continue;
      const rawAmount = vd.priceMoney?.amount;
      const amount = typeof rawAmount === "bigint" ? Number(rawAmount) : (rawAmount ?? 0);
      const price = amount / 100;
      if (price < 2.00) continue;

      flatVariations.push({
        itemId: item.id,
        itemName: data.name,
        itemDescription: data.description ?? "",
        variationId: v.id,
        variationName: vd.name ?? "",
        price,
        sku: vd.sku ?? "",
        categoryIds: (data.categories ?? []).map((c) => c.id),
        imageUrl: primaryImageUrl,
      });
    }
  }

  logger.info("Variations flattened", { count: flatVariations.length });

  // Group variations by brand
  const brandGroups = new Map<string, FlattenedVariation[]>();
  for (const v of flatVariations) {
    const brand = detectBrand(v.itemName);
    if (!brandGroups.has(brand)) brandGroups.set(brand, []);
    brandGroups.get(brand)!.push(v);
  }

  logger.info("Brands detected", { count: brandGroups.size });

  // Build ManagedProducts
  const products: ManagedProduct[] = [];
  const brandCategories: Map<string, ManagedCategory> = new Map();
  let catOrder = 0;

  for (const [brand, members] of brandGroups) {
    if (members.length === 0) continue;
    const product = buildManagedProduct(brand, members);
    products.push(product);

    const catName = getBrandCategoryName(brand);
    const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const catId = `cat_${catSlug}`;

    if (!brandCategories.has(catId)) {
      brandCategories.set(catId, {
        id: catId,
        name: catName,
        slug: catSlug,
        order: catOrder++,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Download images to Firebase Storage (do this before writing to Firestore)
  logger.info("Downloading images...");
  let imagesDownloaded = 0;
  for (const product of products) {
    if (product.images.length > 0) {
      const storageUrls: string[] = [];
      for (const url of product.images.slice(0, 3)) {
        // Only download Square CDN URLs, skip already-local URLs
        if (url.includes("squarecdn.com") || url.includes("squareup.com")) {
          const local = await downloadSquareImage(url);
          if (local) {
            storageUrls.push(local);
            imagesDownloaded++;
          }
        } else {
          storageUrls.push(url); // Keep existing non-Square URLs
        }
      }
      if (storageUrls.length > 0) {
        product.images = storageUrls;
      }
    }
  }
  logger.info("Images processed", { downloaded: imagesDownloaded });

  // Write to Firestore
  logger.info("Writing to Firestore...");
  const MAX_BATCH = 450;
  let batch = db.batch();
  let batchCount = 0;

  const flush = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  for (const [id, category] of brandCategories) {
    batch.set(db.collection("categories").doc(id), category);
    batchCount++;
    if (batchCount >= MAX_BATCH) await flush();
  }

  for (const product of products) {
    batch.set(db.collection("products").doc(product.id), product);
    batchCount++;
    if (batchCount >= MAX_BATCH) await flush();
  }

  await flush();

  // Write sync status
  const syncStatus: SyncStatus = {
    lastSync: now,
    productCount: products.length,
    categoryCount: brandCategories.size,
    itemCount: flatVariations.length,
    errors,
  };
  await db.collection("config").doc("sync_status").set(syncStatus, { merge: true });

  logger.info("Sync complete", syncStatus);

  return {
    success: true,
    products: products.length,
    categories: brandCategories.size,
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

// ─── Import from Square (by Square Category) ─────────────────────
// Alternative grouping strategy: organizes by Square category names
// rather than detected brands. Both output ManagedProduct format.

export async function importFromSquare(
  client: SquareClient,
  db: ReturnType<typeof getFirestore>
): Promise<{ imported: number; errors: string[] }> {
  const now = new Date().toISOString();
  const errors: string[] = [];

  let allItems: Array<Record<string, unknown>> = [];
  let allImages: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;

  do {
    const itemResponse = await client.catalog.search({
      objectTypes: ["ITEM"],
      includeRelatedObjects: true,
      limit: 1000,
      cursor,
    });

    const pageItems = ((itemResponse.objects || []) as unknown[]).filter((o) => {
      const raw = o as Record<string, unknown>;
      const data = raw.itemData as Record<string, unknown> | undefined;
      return data?.ecom_visibility === "VISIBLE";
    }) as Array<Record<string, unknown>>;
    allItems = allItems.concat(pageItems);

    const related = (itemResponse as Record<string, unknown>).relatedObjects as Array<Record<string, unknown>> | undefined;
    const pageImages = (related ?? []).filter((o) => o.type === "IMAGE") as Array<Record<string, unknown>>;
    allImages = allImages.concat(pageImages);

    cursor = (itemResponse as Record<string, unknown>).cursor as string | undefined;
  } while (cursor);

  const imageMap = new Map<string, string>();
  for (const img of allImages) {
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
  for (const item of allItems) {
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

  const MAX_BATCH = 450;

  let batch = db.batch();
  let batchCount = 0;
  let imported = 0;

  const flush = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  let catOrder = 0;

  for (const [brand, items] of brands) {
    const brandSlug = brand.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const categoryId = `cat_${brandSlug}`;

    batch.set(db.collection("categories").doc(categoryId), {
      id: categoryId,
      name: brand,
      slug: brandSlug,
      order: catOrder++,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    batchCount++;

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
        const downloaded = await downloadSquareImage(primaryImageUrl);
        if (downloaded) storageUrl = downloaded;
      }

      const productId = `prod_${brandSlug}_${imported}_${Date.now()}`;
      const productVariants = variations
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
            squareItemId: item.id as string,
            squareVariationId: v.id as string,
          };
        });

      if (productVariants.length === 0) continue;

      const tags = name.toLowerCase().match(/\b[a-z]{3,}\b/g)?.filter(
        (w) => !["the", "and", "for", "with"].includes(w)
      ) ?? [];

      batch.set(db.collection("products").doc(productId), {
        id: productId,
        name,
        description: description.substring(0, 600),
        categoryId,
        productType: detectProductType(brand, tags),
        colors: [],
        tags: [...new Set([brand.toLowerCase(), ...tags])],
        images: storageUrl ? [storageUrl] : [],
        variants: productVariants,
        active: true,
        featured: false,
        createdAt: now,
        updatedAt: now,
        squareItemIds: [item.id as string],
      });
      batchCount++;
      imported++;

      if (batchCount >= MAX_BATCH) {
        await flush();
      }
    }
  }

  await flush();

  await db.collection("config").doc("import_status").set({
    lastImport: now,
    imported,
    errors,
  }, { merge: true });

  return { imported, errors };
}
