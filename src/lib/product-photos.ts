/* ─── The product photo library, as data ──────────────────────────────
   The point of the library is speed: build a product without re-uploading and
   without hand-picking every file. That needs the photos to be grouped, not a
   flat list — so this module turns the collection into BLANK-PRODUCT SETS and
   computes the exact patch to apply to a product.

   Everything here is pure, so the "one action fills every view" behaviour is
   testable without Firestore.
   ────────────────────────────────────────────────────────────────────── */

import {
  PRODUCT_PHOTO_VIEWS,
  type ProductPhoto,
  type ProductPhotoView,
  type ProductType,
} from "@/types";

/** Views -> URL, i.e. ManagedProduct.mockupImages. */
export type MockupImages = Partial<Record<ProductPhotoView, string>>;
/** Colour -> views -> URL, i.e. ManagedProduct.mockupImagesByColor. */
export type ColorMockupImages = Record<string, MockupImages>;

/**
 * Every photo of one blank product.
 *
 * `byView` holds the general (uncoloured) photos — the ones that get tinted for
 * whichever colour the customer picks. `byColorView` holds photos taken of a
 * specific colour, which take precedence over the tint.
 */
export interface BlankPhotoSet {
  name: string;
  productType?: ProductType;
  /** Union of the sets' photos' categoryIds. Empty means "unspecified". */
  categoryIds: string[];
  byView: MockupImages;
  byColorView: ColorMockupImages;
  /** Photos of this blank with no view — gallery material only. */
  unplaced: ProductPhoto[];
  /** Total photos in the set. */
  size: number;
}

/** Keep the first photo seen for a view, so a duplicate upload cannot shadow. */
function place(set: BlankPhotoSet, photo: ProductPhoto): void {
  if (!photo.view) {
    set.unplaced.push(photo);
    return;
  }
  if (photo.color) {
    const forColor = (set.byColorView[photo.color] ??= {});
    if (!forColor[photo.view]) forColor[photo.view] = photo.image_url;
    return;
  }
  if (!set.byView[photo.view]) set.byView[photo.view] = photo.image_url;
}

/**
 * Group the library into blank-product sets, newest photo first within a set so
 * a re-upload wins over the file it replaces.
 *
 * Sets are sorted by how complete they are (most views first) and then by name:
 * the blanks an operator can apply in one click should be at the top.
 */
export function blankPhotoSets(photos: readonly ProductPhoto[]): BlankPhotoSet[] {
  const byName = new Map<string, BlankPhotoSet>();

  for (const photo of photos) {
    if (!photo.image_url) continue;
    const name = (photo.name ?? "").trim() || "Untitled blank";
    let set = byName.get(name);
    if (!set) {
      set = { name, byView: {}, byColorView: {}, unplaced: [], categoryIds: [], size: 0, productType: undefined };
      byName.set(name, set);
    }
    // The newest photo of a set decides the metadata the picker filters on.
    if (set.size === 0) {
      set.productType = photo.productType;
    } else if (!set.productType && photo.productType) {
      set.productType = photo.productType;
    }
    for (const id of photo.categoryIds ?? []) {
      if (!set.categoryIds.includes(id)) set.categoryIds.push(id);
    }
    place(set, photo);
    set.size += 1;
  }

  const viewCount = (s: BlankPhotoSet) =>
    Object.keys(s.byView).length +
    Object.values(s.byColorView).reduce((n, views) => n + Object.keys(views).length, 0);

  return [...byName.values()].sort(
    (a, b) => viewCount(b) - viewCount(a) || a.name.localeCompare(b.name),
  );
}

/** How many of the five mockup slots this set can fill. */
export function coveredViews(set: BlankPhotoSet): ProductPhotoView[] {
  return PRODUCT_PHOTO_VIEWS.filter((view) => Boolean(set.byView[view]));
}

/** Which of the five slots it CANNOT fill — the operator should know before applying. */
export function missingViews(set: BlankPhotoSet): ProductPhotoView[] {
  return PRODUCT_PHOTO_VIEWS.filter((view) => !set.byView[view] && !hasColorView(set, view));
}

function hasColorView(set: BlankPhotoSet, view: ProductPhotoView): boolean {
  return Object.values(set.byColorView).some((views) => Boolean(views[view]));
}

export interface ApplySetResult {
  /** Spread over the form: only the views the set actually provides. */
  mockupImages?: MockupImages;
  mockupImagesByColor?: ColorMockupImages;
  /** Views this set filled. */
  appliedViews: ProductPhotoView[];
  /** Views it could not fill, so the operator is not left guessing. */
  missingViews: ProductPhotoView[];
}

/**
 * The patch that applies a set to a product.
 *
 * Deliberately PARTIAL: it returns only the views the set provides, and the
 * caller merges. A set with front and back must not wipe a sleeve mockup the
 * operator uploaded by hand, and replacing whole maps would do exactly that.
 */
export function applySetPatch(set: BlankPhotoSet): ApplySetResult {
  const mockupImages: MockupImages = {};
  for (const view of PRODUCT_PHOTO_VIEWS) {
    const url = set.byView[view];
    if (url) mockupImages[view] = url;
  }

  const mockupImagesByColor: ColorMockupImages = {};
  for (const [color, views] of Object.entries(set.byColorView)) {
    const filled: MockupImages = {};
    for (const view of PRODUCT_PHOTO_VIEWS) {
      const url = views[view];
      if (url) filled[view] = url;
    }
    if (Object.keys(filled).length > 0) mockupImagesByColor[color] = filled;
  }

  const appliedViews = Object.keys(mockupImages) as ProductPhotoView[];
  const colorViews = Object.values(mockupImagesByColor).flatMap(
    (views) => Object.keys(views) as ProductPhotoView[],
  );
  const covered = new Set<ProductPhotoView>([...appliedViews, ...colorViews]);
  const missing = PRODUCT_PHOTO_VIEWS.filter((view) => !covered.has(view));

  const result: ApplySetResult = { appliedViews, missingViews: missing };
  if (appliedViews.length > 0) result.mockupImages = mockupImages;
  if (Object.keys(mockupImagesByColor).length > 0) result.mockupImagesByColor = mockupImagesByColor;
  return result;
}

export interface PhotoFilters {
  /** Free-text over name, colour and tags. */
  query?: string;
  productType?: ProductType | "all";
  /** A product's category, matched against the photo's categoryIds. */
  categoryId?: string;
  /** Pre-filter to one colour, e.g. when picking a per-colour photo. */
  color?: string;
  /** Only photos that would fill this mockup view. */
  view?: ProductPhotoView;
}

/** Filter the library for the picker. An empty/absent filter field means "any". */
export function filterPhotos(photos: readonly ProductPhoto[], filters: PhotoFilters = {}): ProductPhoto[] {
  const query = (filters.query ?? "").trim().toLowerCase();
  return photos.filter((photo) => {
    if (filters.productType && filters.productType !== "all" && photo.productType && photo.productType !== filters.productType) {
      return false;
    }
    if (filters.color && (photo.color ?? "") !== filters.color) return false;
    if (filters.view && photo.view !== filters.view) return false;
    if (filters.categoryId) {
      // ABSENT means "fits anywhere"; an explicitly EMPTY list means "belongs to
      // no category" — that is the opt-out, and it is what ProductPhoto's type
      // documents. Collapsing the two would silently offer an opted-out photo.
      const ids = photo.categoryIds;
      if (ids && !ids.includes(filters.categoryId)) return false;
    }
    if (query) {
      const haystack = [photo.name, photo.color, ...(photo.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/**
 * Guess a mockup view from a filename, so uploading five files at once can
 * place them all instead of forcing five passes through the form.
 *
 * Ordered, and the order is the contract: "side" variants are tested before
 * sleeve/back/front so `hoodie-left-side.png` cannot be read as a front. A name
 * that names two views resolves to the earlier entry rather than to nothing,
 * which is deterministic and explainable.
 *
 * Each keyword must END at a word boundary, so `backdrop.png` is not a back
 * photo and `frontier.png` is not a front. That trades a little recall
 * (`hoodie_frontprint.png` is left unplaced) for precision: a wrong automatic
 * placement is worse than one the operator picks by hand.
 */
const VIEW_PATTERNS: readonly [ProductPhotoView, RegExp][] = [
  ["sideL", /(?:^|[^a-z])(?:left|side[-_]?l|l[-_]?side)(?![a-z])/],
  ["sideR", /(?:^|[^a-z])(?:right|side[-_]?r|r[-_]?side)(?![a-z])/],
  ["sleeve", /(?:^|[^a-z])(?:sleeve|arm)(?![a-z])/],
  ["back", /(?:^|[^a-z])(?:back|rear)(?![a-z])/],
  ["front", /(?:^|[^a-z])(?:front|main)(?![a-z])/],
];

export function inferViewFromFilename(filename: string): ProductPhotoView | undefined {
  const stem = String(filename ?? "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,5}$/, "")
    .replace(/[_+]+/g, "-");
  if (!stem) return undefined;
  for (const [view, pattern] of VIEW_PATTERNS) {
    if (pattern.test(stem)) return view;
  }
  return undefined;
}

/** A Storage-safe filename: keeps the extension, drops anything exotic. */
export function safePhotoName(filename: string): string {
  const base = String(filename ?? "photo").split(/[\\/]/).pop() ?? "photo";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
}
