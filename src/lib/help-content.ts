/**
 * Admin help content — the searchable user guide + step-by-step tutorials.
 * Rendered by <HelpGuide /> in the admin "Help" tab.
 */

export interface HelpEntry {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  body: string; // plain text with blank-line paragraph breaks
}

export interface HelpTutorial {
  id: string;
  title: string;
  description: string;
  steps: { title: string; body: string }[];
}

export const HELP_ENTRIES: HelpEntry[] = [
  {
    id: "getting-started",
    title: "Getting started",
    category: "Basics",
    keywords: ["welcome", "start", "overview", "admin", "dashboard"],
    body: "The Admin dashboard is where you run the whole store.\n\nThe tabs across the top are: Products, Categories, Settings, Designs, Images, Orders, Users, Admins, and Help.\n\nStart by opening the Products tab and turning on the shop: add a product (name, price, variants), then set it Active. The public storefront at animas-reflections-pwa.web.app updates automatically on publish.",
  },
  {
    id: "products",
    title: "Manage products",
    category: "Products",
    keywords: ["product", "add", "edit", "delete", "price", "active", "featured", "sku"],
    body: "In Products, click “+ New Product” (or an existing product) to open the editor.\n\nRequired: Name, Category, and at least one Variant with a price.\n\nToggle Active to show/hide the product on the storefront. Toggle Featured to pin it to the homepage.\n\nImages, colors, and add-ons are managed in the same editor.",
  },
  {
    id: "variants",
    title: "Variants, options & inventory",
    category: "Products",
    keywords: ["variant", "size", "sku", "inventory", "stock", "out of stock", "matrix"],
    body: "Variants are the specific versions you sell, e.g. “Large / Navy”. Each has a name, price, SKU, and optional inventory count.\n\nUse the Variant Matrix (or the manual list) to add size/color combinations quickly.\n\nSet Inventory per variant. When a variant’s inventory is 0, customers see “Out of Stock” on the product page and cannot add it to the cart or check out.",
  },
  {
    id: "colors",
    title: "Colors & the color library",
    category: "Products",
    keywords: ["color", "swatch", "color library", "hex", "tint"],
    body: "Colors come from the Site Color Library (Settings → Catalog Options). Pick the colors that apply to a product, or add a custom color in the product editor.\n\nClick “Save” next to a custom color to add it to the site color library, so it becomes available on every product.\n\nAssign a swatch hex and per-color photos in the “Color Images” section.",
  },
  {
    id: "modifiers",
    title: "Add-ons & modifier groups",
    category: "Products",
    keywords: ["addon", "modifier", "group", "personalization", "back print", "sleeve", "toggle", "text", "file"],
    body: "Add-ons are the extras a customer can add: Back Print, Sleeve Print, Name/Number, etc.\n\nEach modifier has a price (Fixed $ or % of base) and an input type: Toggle (price only), Text (e.g. a name/number), or File (custom artwork upload).\n\nGroup modifiers by typing a Group name — modifiers in the same group appear together under a heading in the customizer.",
  },
  {
    id: "csv-import",
    title: "Import your catalog from a CSV",
    category: "Catalog",
    keywords: ["csv", "import", "square", "export", "bulk", "spreadsheet", "upload"],
    body: "You can build a whole catalog from a CSV file.\n\nProducts → Import CSV. Download the template to see the format, or use a Square item export (item_name, variation_name, item_price, item_sku all work).\n\nOne row per variant; rows sharing a product name are grouped into one product. The tool upserts (adds new, updates existing) and reports how many were created/updated plus any row errors.",
  },
  {
    id: "categories",
    title: "Categories & organizing the shop",
    category: "Catalog",
    keywords: ["category", "subcategory", "parent", "organize", "nav"],
    body: "Categories group products for the shop and navigation.\n\nCreate categories in the Categories tab. Use a Parent category to make subcategories. Reorder them with the drag handles. You can’t delete a category that still has products or subcategories.",
  },
  {
    id: "images",
    title: "Images & product photos",
    category: "Catalog",
    keywords: ["image", "photo", "upload", "gallery", "mockup", "color image"],
    body: "Add product photos in the Images tab, or in the product editor.\n\nAssign a gallery image to each color so the product page shows the right photo when a customer picks a color (Color Images section).\n\nUpload blank mockup photos for the customizer so designs preview on real garments.",
  },
  {
    id: "designs",
    title: "The design library",
    category: "Catalog",
    keywords: ["design", "artwork", "logo", "printable", "library", "upload"],
    body: "Designs are reusable graphics customers can print on products.\n\nAdd designs in the Designs tab (name, category, tags, image). Then, in a product’s editor, pin up to 10 “Printable Designs” so they appear in that product’s customizer.\n\nDesigns are stored once and reused across any product.",
  },
  {
    id: "customizer",
    title: "The design customizer",
    category: "Storefront",
    keywords: ["customizer", "customize", "design", "mockup", "print zone", "add to cart"],
    body: "Customers open the customizer from a product (“Customize This”). They pick a color, then drag/resize/rotate a design or text within the print zone, add optional add-ons, and add to cart.\n\nProducts need a color and a print zone set to preview correctly. Designs and add-ons are managed in the admin.",
  },
  {
    id: "checkout",
    title: "Checkout & payments (Square)",
    category: "Storefront",
    keywords: ["checkout", "square", "payment", "card", "shipping", "tax", "cart"],
    body: "Checkout uses Square to securely take payment. Prices, add-ons, and shipping are re-priced server-side to prevent tampering.\n\nShipping tiers and the free-shipping threshold are set in Settings. If an item is out of stock, checkout is blocked for that item.\n\nOrders are mirrored to Firestore and appear under Orders.",
  },
  {
    id: "orders",
    title: "Orders & fulfillment",
    category: "Storefront",
    keywords: ["order", "fulfillment", "tracking", "shipped", "customer", "square order"],
    body: "Orders appear in the Orders tab with customer info, line items, design files, and totals.\n\nAdd a tracking number/URL to an order and update its status (Processing, Shipped, Delivered, etc.).\n\nOrders are matched to customer accounts by email.",
  },
  {
    id: "users-admins",
    title: "Users, accounts & admin access",
    category: "Admin",
    keywords: ["user", "admin", "access", "login", "role", "email", "invite"],
    body: "Customers create accounts to see orders and saved addresses.\n\nAdmins are controlled by the allowlist in the Admins tab. Only emails in that list can access the admin dashboard and upload product photos — add or remove admins there. This is the secure way to grant access (never rely on an email domain).",
  },
  {
    id: "settings",
    title: "Site settings & catalog options",
    category: "Admin",
    keywords: ["settings", "colors", "sizes", "product types", "shipping", "announcement", "font", "theme"],
    body: "Settings controls site-wide options: announcement bar, brand colors, fonts, shipping tiers, and the Catalog Options (colors, sizes, product types) and default add-ons.\n\nChanges publish to the storefront (colors/fonts apply instantly via CSS variables). Saved via the site config.",
  },
  {
    id: "seo",
    title: "SEO & product metadata",
    category: "Admin",
    keywords: ["seo", "search", "meta", "title", "description", "slug", "json-ld"],
    body: "Each product can set a custom SEO title and meta description (falls back to the name/description). Set them in the product editor.\n\nThe site ships JSON-LD (Organization, FAQ, Breadcrumb) for search engines. Product pages are statically exported.",
  },
];

export const TUTORIALS: HelpTutorial[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Publish your first products and turn on the storefront.",
    steps: [
      { title: "Add a category", body: "Categories → + New Category. Names group products on the shop page." },
      { title: "Create a product", body: "Products → + New Product. Add a name, pick the category, and set a price." },
      { title: "Add variants", body: "Use the Variant Matrix (or manual list) to add sizes/colors with prices and inventory." },
      { title: "Add images", body: "Upload photos in the Images tab and assign gallery images per color." },
      { title: "Publish", body: "Set the product Active. It appears on the storefront immediately." },
    ],
  },
  {
    id: "import-csv",
    title: "Import a catalog from Square / CSV",
    description: "Export from Square and import all items here, in bulk.",
    steps: [
      { title: "Get your file", body: "Export your items from Square to a CSV, or download the template in Products → Import CSV." },
      { title: "Format", body: "One row per variant. Required: product name; plus variant/price/sku/inventory, colors, category, etc. Square column names (item_name, variation_name, item_price, item_sku) are accepted." },
      { title: "Import", body: "Products → Import CSV → choose your file. Rows sharing a product name become one product with multiple variants." },
      { title: "Review", body: "Check the created/updated count and any row errors. Fix flagged rows and import again to upsert." },
    ],
  },
  {
    id: "add-product-variants",
    title: "Add a product with color/size variants",
    description: "A worked example for a T-shirt sold in sizes and colors.",
    steps: [
      { title: "Create the product", body: "Name: “Classic Tee”, Category: Apparel, Type: Apparel." },
      { title: "Pick colors", body: "Select colors from the site color library (or add + Save a custom color)." },
      { title: "Build the matrix", body: "In the Variant Matrix, add Size + Color columns and a price per combination." },
      { title: "Set inventory", body: "Enter stock per variant. 0 shows “Out of Stock” and blocks purchase." },
      { title: "Add images", body: "Upload front/back photos and assign per-color color images." },
      { title: "Publish", body: "Set Active. It’s live on the shop page." },
    ],
  },
];

export function searchHelp(query: string): HelpEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return HELP_ENTRIES;
  return HELP_ENTRIES.filter((e) => {
    const hay = [e.title, e.category, e.body, ...e.keywords].join(" ").toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });
}
