import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import { SquareClient } from "square";

export interface BaseProduct {
  id: string;
  name: string;
  type: string;
  category: string;
  defaultImage: string;
  description: string;
  tags: string[];
}

export interface ProductDesign {
  id: string;
  name: string;
  brand: string;
  category: string;
  logoUrl: string;
}

export interface ProductInstance {
  id: string;
  baseProductId: string;
  designId: string;
  name: string;
  price: number;
  image: string;
  sku: string;
  squareItemId: string;
  squareVariationId: string;
  active: boolean;
  updatedAt: string;
}

export interface PipelineResult {
  baseProducts: number;
  designs: number;
  instances: number;
  items: number;
  errors: string[];
}

// ─── Known Base Product Type Patterns ─────────────────────────────

const BASE_TYPE_PATTERNS: [RegExp, string, string][] = [
  // Apparel — most specific first
  [/\bzip[ -]?up hoodie\b/i, "Zip-Up Hoodie", "Apparel"],
  [/\bpullover hood\b/i, "Pullover Hoodie", "Apparel"],
  [/\bsupercotton.*hood\b/i, "Supercotton Hoodie", "Apparel"],
  [/\byouth hoodie\b/i, "Youth Hoodie", "Apparel"],
  [/\bhoodie\b/i, "Hoodie", "Apparel"],
  [/\bracerback tank\b/i, "Racerback Tank", "Apparel"],
  [/\bjersey tank\b/i, "Jersey Tank", "Apparel"],
  [/\btank\b(?!.*top)/i, "Tank Top", "Apparel"],
  [/\blong sleeve.*unisex\b/i, "Long Sleeve Tee", "Apparel"],
  [/\bjersey t[- ]?shirt\b/i, "Jersey T-Shirt", "Apparel"],
  [/\bperformance.*t[- ]?shirt\b/i, "Performance T-Shirt", "Apparel"],
  [/\bwomen.*t[- ]?shirt\b/i, "Women's T-Shirt", "Apparel"],
  [/\byouth.*short.*sleeve\b/i, "Youth Tee", "Apparel"],
  [/\bt[- ]?shirt\b/i, "T-Shirt", "Apparel"],
  [/\btee\b/i, "T-Shirt", "Apparel"],
  [/\bpullover\b/i, "Pullover", "Apparel"],
  [/\bjersey\b/i, "Jersey", "Apparel"],
  [/\bone[- ]?piece\b/i, "One-Piece", "Apparel"],
  [/\bbaseball.*jersey\b/i, "Baseball Jersey", "Apparel"],
  [/\bfootball.*jersey\b/i, "Football Jersey", "Apparel"],
  [/\bhockey.*sweater\b/i, "Hockey Jersey", "Apparel"],
  [/\bsun shirt\b/i, "Sun Shirt", "Apparel"],

  // Headwear
  [/\bknit beanie\b/i, "Knit Beanie", "Headwear"],
  [/\bbeanie\b/i, "Beanie", "Headwear"],
  [/\bhat\b/i, "Hat", "Headwear"],
  [/\bsnapback\b/i, "Snapback Cap", "Headwear"],

  // Stickers & Slaps
  [/\bholiday.*slap.*pack\b/i, "Holiday Slap Pack", "Stickers"],
  [/\b(?:5[- ]?7|4|3) inch slap\b/i, "Large Slap", "Stickers"],
  [/\b(?:4|3) inch slap\b/i, "Slap Sticker", "Stickers"],
  [/\bslap/i, "Slap Sticker", "Stickers"],
  [/\bsticker\b/i, "Sticker", "Stickers"],
  [/\bdecal\b/i, "Decal", "Stickers"],

  // Drinkware
  [/\bcoffee mug\b/i, "Coffee Mug", "Drinkware"],
  [/\bmug\b/i, "Mug", "Drinkware"],
  [/\bcan cooler\b/i, "Can Cooler", "Drinkware"],
  [/\bdrink hugger\b/i, "Drink Hugger", "Drinkware"],
  [/\bkoozie\b/i, "Koozie", "Drinkware"],

  // Home & Decor
  [/\b(?:110|piece) puzzle\b/i, "Puzzle", "Home"],
  [/\bblanket\b/i, "Blanket", "Home"],
  [/\bflag\b/i, "Flag", "Home"],
  [/\bplaying cards\b/i, "Playing Cards", "Home"],
  [/\bcoloring book\b/i, "Coloring Book", "Home"],
  [/\bwindshield|sunshade\b/i, "Windshield Sunshade", "Home"],
  [/\bfolding chair\b/i, "Folding Chair", "Home"],
  [/\blicense plate frame\b/i, "License Plate Frame", "Home"],

  // Ornaments
  [/\bacrylic.*ornament\b/i, "Acrylic Ornament", "Ornaments"],
  [/\b(?:round|heart|star).*ornament\b/i, "Ceramic Ornament", "Ornaments"],
  [/\b(?:wood|slate).*ornament\b/i, "Wood Ornament", "Ornaments"],
  [/\bornament\b/i, "Ornament", "Ornaments"],

  // Accessories
  [/\bpet scarf\b/i, "Pet Scarf", "Accessories"],
  [/\bbottle opener\b/i, "Bottle Opener", "Accessories"],
  [/\bkey[- ]?chain\b/i, "Keychain", "Accessories"],
  [/\blanyard\b/i, "Lanyard", "Accessories"],
  [/\bbic lighter\b/i, "Bic Lighter", "Accessories"],
  [/\bgpk.*cards\b/i, "Trading Cards", "Accessories"],
  [/\biron[- ]?on.*patch\b/i, "Iron-On Patch", "Accessories"],
  [/\bherb grinder\b/i, "Herb Grinder", "Accessories"],
  [/\bmystery box\b/i, "Mystery Box", "Accessories"],

  // Jewelry
  [/\bearrings\b/i, "Earrings", "Jewelry"],
  [/\bpendant\b/i, "Pendant", "Jewelry"],
  [/\bnecklace\b/i, "Necklace", "Jewelry"],

  // Tech
  [/\bbluetooth.*speaker\b/i, "Bluetooth Speaker", "Tech"],
  [/\bfrisbee\b/i, "Foldable Frisbee", "Outdoor"],
  [/\bgear bag\b/i, "Gear Bag", "Bags"],
  [/\btote\b/i, "Tote Bag", "Bags"],

  // Fallback
  [/\bpanel\b/i, "Photo Panel", "Decor"],
  [/\bslate\b/i, "Photo Slate", "Decor"],
  [/\bwood\b.*(?:sign|panel)\b/i, "Wood Sign", "Decor"],
];

function detectBaseType(name: string): { typeName: string; category: string } | null {
  for (const [pattern, typeName, category] of BASE_TYPE_PATTERNS) {
    if (pattern.test(name)) {
      return { typeName, category };
    }
  }
  return null;
}

const KNOWN_DESIGNS = [
  "GREEN BUDDHA", "GREEN BUDDAH",
  "Dunphy Stock FAM", "DUNPHY",
  "LITTLE STRANGER",
  "Jordan Branch Music", "JORDAN BRANCH",
  "BISCUIT HOCKEY",
  "I'M OK R U", "IM OK R U",
  "Durango Lacrosse", "Durango Hockey",
  "Durango Roller Girls",
  "Durango High School Alpine Ski",
  "ET Art",
  "Women In Aviation",
  "Fly High AA",
  "Kevin Fundraiser",
];

function detectDesign(itemName: string, categoryName: string): string {
  const upper = itemName.toUpperCase();
  for (const design of KNOWN_DESIGNS) {
    if (upper.includes(design.toUpperCase())) {
      return design;
    }
  }
  return categoryName || "General";
}

function normalizeDesignName(name: string): string {
  const map: Record<string, string> = {
    "GREEN BUDDAH": "GREEN BUDDHA",
    "DUNPHY": "Dunphy Stock FAM",
    "JORDAN BRANCH": "Jordan Branch Music",
    "IM OK R U": "I'M OK R U",
    "BISCUIT HOCKEY": "Biscuit Hockey",
    "KEVIN FUNDRAISER": "LITTLE STRANGER",
  };
  return map[name.toUpperCase()] ?? name;
}

export async function runProductPipeline(
  client: SquareClient,
  db: ReturnType<typeof getFirestore>
): Promise<PipelineResult> {
  const errors: string[] = [];

  logger.info("Fetching full Square catalog...");
  let allItems: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;

  do {
    const response = await client.catalog.search({
      objectTypes: ["ITEM"],
      includeRelatedObjects: true,
      limit: 1000,
      cursor,
    });
    const page = ((response.objects ?? []) as unknown[]).filter((o) => {
      const raw = o as Record<string, unknown>;
      const data = raw.itemData as Record<string, unknown> | undefined;
      return data?.ecom_visibility === "VISIBLE";
    }) as Array<Record<string, unknown>>;
    allItems = allItems.concat(page);
    cursor = (response as Record<string, unknown>).cursor as string | undefined;
  } while (cursor);

  const catResponse = await client.catalog.search({
    objectTypes: ["CATEGORY"],
  });
  const rawCategories = (catResponse.objects ?? []) as unknown as Array<Record<string, unknown>>;
  const categoryMap = new Map<string, string>();
  for (const c of rawCategories) {
    const cd = c.categoryData as Record<string, string> | undefined;
    if (cd?.name) categoryMap.set(c.id as string, cd.name);
  }

  logger.info("Parsing items...", { total: allItems.length });

  const baseProductMap = new Map<string, BaseProduct>();
  const designMap = new Map<string, ProductDesign>();
  const instances: ProductInstance[] = [];

  for (const item of allItems) {
    const data = (item.itemData || {}) as Record<string, unknown>;
    const name = (data.name as string) ?? "";
    const description = (data.description as string) ?? "";
    const cats = (data.categories || []) as Array<{ id: string }>;
    const categoryName = cats.map((c) => categoryMap.get(c.id) ?? "").find(Boolean) ?? "Other";
    const variations = (data.variations || []) as Array<Record<string, unknown>>;

    const baseType = detectBaseType(name);
    const designName = normalizeDesignName(detectDesign(name, categoryName));

    if (!baseType) {
      errors.push(`Unknown type: ${name}`);
      continue;
    }

    const baseKey = baseType.typeName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (!baseProductMap.has(baseKey)) {
      baseProductMap.set(baseKey, {
        id: `base_${baseKey}`,
        name: baseType.typeName,
        type: baseType.category,
        category: baseType.category,
        defaultImage: "",
        description: "",
        tags: [baseType.category.toLowerCase(), baseType.typeName.toLowerCase()],
      });
    }

    const designKey = designName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (!designMap.has(designKey)) {
      designMap.set(designKey, {
        id: `design_${designKey}`,
        name: designName,
        brand: designName,
        category: categoryName,
        logoUrl: "",
      });
    }

    for (const v of variations) {
      const vd = (v.itemVariationData || {}) as Record<string, unknown>;
      const pm = vd.priceMoney as { amount?: bigint } | undefined;
      const price = pm?.amount ? Number(pm.amount) / 100 : 0;
      if (price < 2) continue;

      const instanceId = `prod_${baseKey}_${designKey}_${(v.id as string)?.slice(0, 8) ?? Date.now()}`;

      instances.push({
        id: instanceId,
        baseProductId: `base_${baseKey}`,
        designId: `design_${designKey}`,
        name: `${designName} ${baseType.typeName}`,
        price,
        image: "",
        sku: (vd.sku as string) ?? "",
        squareItemId: (item.id as string) ?? "",
        squareVariationId: (v.id as string) ?? "",
        active: true,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  logger.info("Writing to Firestore...");

  const MAX_BATCH = 400;
  let batch = db.batch();
  let count = 0;

  const flush = async () => {
    if (count > 0) { await batch.commit(); batch = db.batch(); count = 0; }
  };

  for (const [_, bp] of baseProductMap) {
    batch.set(db.collection("baseProducts").doc(bp.id), bp, { merge: true });
    if (++count >= MAX_BATCH) await flush();
  }

  for (const [_, design] of designMap) {
    batch.set(db.collection("designs").doc(design.id), design, { merge: true });
    if (++count >= MAX_BATCH) await flush();
  }

  for (const inst of instances) {
    batch.set(db.collection("productInstances").doc(inst.id), inst, { merge: true });
    if (++count >= MAX_BATCH) await flush();
  }

  await flush();

  await db.collection("config").doc("pipeline_status").set({
    lastRun: new Date().toISOString(),
    baseProducts: baseProductMap.size,
    designs: designMap.size,
    instances: instances.length,
    items: allItems.length,
    errors,
  }, { merge: true });

  return {
    baseProducts: baseProductMap.size,
    designs: designMap.size,
    instances: instances.length,
    items: allItems.length,
    errors,
  };
}

export async function getPipelineStatus(
  db: ReturnType<typeof getFirestore>
): Promise<{
  lastRun: string | null;
  baseProducts: number;
  designs: number;
  instances: number;
  errors: string[];
}> {
  const snap = await db.collection("config").doc("pipeline_status").get();
  const data = snap.data() ?? {};
  return {
    lastRun: (data.lastRun as string) ?? null,
    baseProducts: (data.baseProducts as number) ?? 0,
    designs: (data.designs as number) ?? 0,
    instances: (data.instances as number) ?? 0,
    errors: (data.errors as string[]) ?? [],
  };
}
