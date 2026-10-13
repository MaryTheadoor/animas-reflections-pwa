/**
 * Admin help content — the searchable user guide + step-by-step tutorials.
 * Rendered by <HelpGuide /> in the admin "Help" tab.
 *
 * Ported from the Content & Theme line (origin/master, commit 4a23bc3) which had it live
 * before that deployment was overwritten. Entries describing features that exist only on
 * that line were removed or corrected so the guide matches the admin actually deployed —
 * see docs/STATUS_SWEEP.md §1.
 *
 * Status of the previously-removed wording (updated 2026-10-06):
 *  - "Import your catalog from a CSV" → restored as `catalog-import`, rewritten for this
 *    line now that categories resolve and re-imports update in place.
 *  - modifier Groups and the colour library → both reinstated on this line, and their
 *    entries above describe them again.
 *  - visual print-zone drag/resize → reinstated; the `print-zones` entry describes it.
 * If the two lines are ever reconciled, prefer this file's wording: it matches the
 * deployed admin, whereas origin/master's copy describes features it alone has.
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
    body: "The Admin dashboard is where you run the whole store.\n\nThe tabs across the top are: Products, Categories, SEO, Settings, Designs, Images, Orders, Users, Admins, Content & Theme, and Help.\n\nStart by opening the Products tab and turning on the shop: add a product (name, price, variants), then set it Active. The public storefront updates automatically once the site is published. To change the site's words, colours or fonts, use the Content & Theme tab.",
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
    body: "Variants are the specific versions you sell, e.g. “Large / Navy”. Each has a name, price, SKU, and optional inventory count.\n\nUse the Variant Matrix (or the manual list) to add size/color combinations. You do not have to click every cell: set the base price first, then Add all in view fills the cells on screen, and Add every combination fills the whole grid when a third dimension is in play. Apply this price to all pushes the base price onto variants you already created. Before a large batch you are asked to confirm.\n\nSet Inventory per variant. Inventory drives the stock badges on the shop page and the availability flag in the page’s structured data — it is a display and search signal, not a hard sales block.",
  },
  {
    id: "colors",
    title: "Colors & swatches",
    category: "Products",
    keywords: ["color", "swatch", "hex", "tint", "color images"],
    body: "The list of site colors (and sizes and product types) lives in Settings → Catalog Options. Pick the colors that apply to a product in its editor, or type a custom color name for that product.\n\nEach color can take a swatch hex and per-color photos in the “Color Images” section, so the product page and customizer show the right look when a customer picks that color.",
  },
  {
    id: "modifiers",
    title: "Add-ons",
    category: "Products",
    keywords: ["addon", "modifier", "personalization", "back print", "sleeve", "toggle", "text", "file"],
    body: "Add-ons are the extras a customer can add: Back Print, Sleeve Print, Name/Number, etc.\n\nEach add-on has a price (Fixed $ or % of base) and an input type: Toggle (price only), Text (e.g. a name/number), or File (custom artwork upload).\n\nA product can use the site-wide default add-ons, opt out entirely, or define its own set with editable prices.",
  },
  {
    id: "categories",
    title: "Categories & organizing the shop",
    category: "Catalog",
    keywords: ["category", "subcategory", "parent", "organize", "nav"],
    body: "Categories group products for the shop and navigation.\n\nCreate categories in the Categories tab and reorder them there. Categories also drive the “By Design / Brand” browse mode on the shop page, and the featured-category filters on the fundraising page.",
  },
  {
    id: "catalog-import",
    title: "Migrating a catalog from Square",
    category: "Catalog",
    keywords: ["import", "csv", "migrate", "migration", "square", "export", "spreadsheet", "bulk", "upload", "catalog"],
    body: "You can bring an existing Square catalog in from a spreadsheet instead of retyping every product.\n\n1. Export from Square. In the Square Dashboard, export your item library to CSV. If you sell the same catalog in person, the export may include POS-only items — the website products are the ones marked visible online, so filter to those first.\n\n2. Check the sheet. One row per variant. Rows that share the same product name are grouped into one product with several variants. Every row needs a name, and any row with variant data needs a price. Our template column names work, and Square's own export column names are accepted as-is (item_name, variation_name, item_price, item_sku), so a raw Square export can normally be uploaded unchanged.\n\nOptional columns: sku, inventory, colors (semicolon- or pipe-separated), category, productType, description, active, featured, image (plus image2 and image3), seoTitle, seoDescription.\n\n3. Create the categories first — or let the import make them. The import matches the category names in your sheet against the categories you already have in the Categories tab. Tick “Create missing categories” and it will also create any it cannot match (choosing the deepest level of a path like “Bands > LITTLE STRANGER” and ignoring the trailing Square id). Leave it unticked and unmatched names are only reported, which is safer if the sheet contains internal buckets like “Fundraising Pricing”, “Custom”, “Donation” or “Shipping” that should not become categories. Either way the report lists every name it could not place.\n\n4. Import. Products → Import CSV → choose your file. “Download template” gives you a starter file with the right column names.\n\n5. Read the report. You get how many products were created, updated, and matched an existing product; a “Needs your attention” list (unmatched categories, columns that mapped to nothing, product types that fell back to “other”); and any rows that failed outright.\n\n6. Correct and re-import. Re-uploading the same file updates the same products rather than creating duplicates, so the usual loop is: fix the spreadsheet, upload again, check the report.\n\n7. Bring the add-ons across. Square keeps add-ons (modifier sets) separately from items and offers no export for them, so the sheet records only WHICH sets each product uses. After importing, click “Import Square add-ons” and the choices and prices are read from Square and attached, grouped under each set's name. Run the import first — the add-on step needs the spreadsheet to have recorded the associations.\n\nWhat the import works out for you: if a variant label names a size or a colour (“L / Navy”, “X-Large”, “3\””), those dimensions are built on the product and each variant is mapped into them, so the variant matrix shows real Size and Color columns. And if a product name matches one of your brands (Biscuit Hockey, LITTLE STRANGER, Durango Hockey, Drink Huggers and so on), that brand is used as the category when the sheet does not name one. Archived items import as inactive, stock and weight come across, and each variant keeps its Square variation id. Anything it could not work out — a variant label with no recognisable size or colour, a brand category that does not exist yet, a product type it had to guess, two Square sets sharing a name — is listed in the report so you can finish it by hand.",
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
    body: "Designs are reusable graphics customers can print on products.\n\nAdd designs in the Designs tab (name, category, tags, image). Then, in a product’s editor, pin up to 10 “Printable Designs” so they appear in that product’s customizer.\n\nDesigns are stored once and reused across any product. The Designs tab also has a “Migrate Old Data” action for the legacy flat format.",
  },
  {
    id: "customizer",
    title: "The design customizer",
    category: "Storefront",
    keywords: ["customizer", "customize", "design", "mockup", "print zone", "add to cart"],
    body: "Customers open the customizer from a product (“Customize This”, shown when the product is marked customizable). They pick a color, then drag/resize/rotate a design or text within the print zone, add optional add-ons, and add to cart.\n\nProducts need a color and a print zone set to preview correctly. Designs and add-ons are managed in the admin.",
  },
  {
    id: "print-zones",
    title: "Print zones & garment mockups",
    category: "Catalog",
    keywords: ["print zone", "mockup", "printable", "print area", "customizer", "zone"],
    body: "A print zone is the printable area on a garment view (front, back, sleeve, left/right side), stored as percentages of the mockup.\n\nIn the product editor → Print Zones, pick a view and enter the zone’s X, Y, width, and height as percentages. If a view is left blank, the customizer falls back to a default zone.\n\nUpload a mockup photo (Admin → Images) so the customizer and the product page have a real garment to preview on.",
  },
  {
    id: "checkout",
    title: "Checkout & payments (Square)",
    category: "Storefront",
    keywords: ["checkout", "square", "payment", "card", "shipping", "tax", "cart"],
    body: "Checkout uses Square to securely take payment. Prices, add-ons, and shipping are re-priced server-side to prevent tampering.\n\nShipping tiers and the free-shipping threshold are set in Settings, and an individual product can override shipping with its own flat rate.\n\nOrders are mirrored to Firestore and appear under Orders.",
  },
  {
    id: "orders",
    title: "Orders & fulfillment",
    category: "Storefront",
    keywords: ["order", "fulfillment", "tracking", "shipped", "customer", "square order"],
    body: "Orders appear in the Orders tab with customer info, line items, design files, and totals. Square orders are merged with the Firestore order mirror so nothing from a manual order is lost.\n\nAdd a tracking number/URL to an order to update its status, and open the saved design files from the order row for printing.\n\nOrders are matched to customer accounts by email.",
  },
  {
    id: "users-admins",
    title: "Users, accounts & admin access",
    category: "Admin",
    keywords: ["user", "admin", "access", "login", "role", "email", "invite"],
    body: "Customers create accounts to see their orders and saved addresses.\n\nAdmins are controlled by the allowlist in the Admins tab. Only emails in that list can access the admin dashboard and upload product photos — add or remove admins there. This is the secure way to grant access (never rely on an email domain alone).",
  },
  {
    id: "content-theme",
    title: "Editing site copy, colours & fonts",
    category: "Admin",
    keywords: ["copy", "content", "text", "wording", "theme", "colors", "colours", "font", "dark mode", "announcement", "contrast", "accessibility"],
    body: "The Content & Theme tab is where the site's words, colours and fonts are edited. It is the ONLY place they live — the Settings tab used to carry duplicates of these controls, and every one of them was dead.\n\nCopy — pick a page (Home, About, Contact, FAQ, Fundraising, Terms, Privacy, Biscuit Hockey, I'M OK R U, Navigation, Global), then edit its fields. Each field has a Reset that restores the built-in wording, and \"+\" adds a row to the repeatable lists (FAQ questions, Terms/Privacy sections, fundraising steps). Saving is instant: the storefront reads the copy live, with no rebuild.\n\nTheme — Light and Dark sub-tabs, a colour picker plus hex box per token, and font dropdowns. Edits preview on the page as you change them; Save applies them everywhere.\n\nThe contrast floor: if a colour you pick cannot be read on its background (WCAG AA, 4.5:1), it is not published as-is. The readable default is used instead and a note appears listing what changed and why, so the site cannot end up with unreadable text. Page titles and meta descriptions are NOT here — they are per-page and live in the SEO tab.",
  },
  {
    id: "settings",
    title: "Site settings & catalog options",
    category: "Admin",
    keywords: ["settings", "sizes", "product types", "shipping", "catalog options", "threshold"],
    body: "Settings controls store-wide options: the shipping tiers and free-shipping threshold, the default add-on price, the customer fields collected at checkout, and the Catalog Options (the colours, sizes and product types a product can use, plus the default add-ons).\n\nBrand colours, fonts and all site copy are edited in the Content & Theme tab instead.",
  },
  {
    id: "seo",
    title: "SEO, page metadata & keywords",
    category: "Admin",
    keywords: ["seo", "search", "meta", "title", "description", "keyword", "slug", "json-ld", "sitemap", "publish"],
    body: "The SEO tab has three parts.\n\nPage metadata — title and description overrides for every indexable page, with live character counters and a per-page reset. A saved change takes effect for visitors on their next page load, with no rebuild. A blank field always falls back to the built-in default, so a cleared box can never publish an empty title.\n\nKeyword landing pages — real static pages at /your-slug for the search terms you want to rank for, each listed in the sitemap and cross-linked from the Services page.\n\nPublish — dispatches a site rebuild. Search engines and social scrapers read the built HTML and do not run JavaScript, so they only see an edited title or description after a Publish. Publishing is also what creates a NEW keyword page.\n\nThe site ships generated sitemap.xml and robots.txt, and JSON-LD (Web site, Local Business, FAQ, and breadcrumbs) for search engines.",
  },
];

export const TUTORIALS: HelpTutorial[] = [
  {
    id: "migrate-from-square",
    title: "Migrate a catalog from Square",
    description: "Export your Square items, tidy the sheet, and bring them in here.",
    steps: [
      { title: "Export from Square", body: "In the Square Dashboard, export your item library to a CSV file. If you also sell in person, filter out POS-only items first — the website products are the ones marked visible online." },
      { title: "Create the categories", body: "In the Categories tab, add every category your sheet refers to, with names spelled the way the sheet spells them. The import matches by name and will not create categories for you." },
      { title: "Check the sheet", body: "One row per variant; rows sharing a product name become one product. Every row needs a name, and any row with variant data needs a price. Square's own column names are accepted, so the export usually works as-is." },
      { title: "Import", body: "Products → Import CSV → choose your file. Use Download template if you are building a sheet from scratch." },
      { title: "Read the report", body: "Check the created/updated counts, then the “Needs your attention” list: unmatched categories, columns that mapped to nothing, and product types that fell back to “other”. Failed rows are listed separately." },
      { title: "Correct and re-import", body: "Fix the spreadsheet and upload it again. Re-importing updates the same products rather than duplicating them, so repeat until the report is clean." },
      { title: "Bring the add-ons across", body: "Click Import Square add-ons. The sheet recorded which add-on sets each product uses; this reads their choices and prices from Square and attaches them, grouped by set name." },
      { title: "Tidy up per product", body: "Sizes and colours are worked out from your variant labels automatically, and a product name that matches one of your brands is filed under that brand's category. Anything the import could not work out is listed in the report — finish those by hand in the product editor." },
    ],
  },
  {
    id: "getting-started",
    title: "Getting started",
    description: "Publish your first products and turn on the storefront.",
    steps: [
      { title: "Add a category", body: "Categories → + New Category. Categories group products on the shop page." },
      { title: "Create a product", body: "Products → + New Product. Add a name, pick the category, and set a price." },
      { title: "Add variants", body: "Use the Variant Matrix (or manual list) to add sizes/colors with prices and inventory." },
      { title: "Add images", body: "Upload photos in the Images tab and assign gallery images per color." },
      { title: "Publish", body: "Set the product Active. It appears on the storefront once the site is published." },
    ],
  },
  {
    id: "add-product-variants",
    title: "Add a product with color/size variants",
    description: "A worked example for a T-shirt sold in sizes and colors.",
    steps: [
      { title: "Create the product", body: "Name: “Classic Tee”, Category: Apparel, Type: Apparel." },
      { title: "Pick colors", body: "Select the colors this product is sold in, or type a custom color name." },
      { title: "Build the matrix", body: "In the Variant Matrix, add Size + Color columns and a price per combination." },
      { title: "Set inventory", body: "Enter stock per variant. It drives the stock badges customers see." },
      { title: "Add images", body: "Upload front/back photos and assign per-color color images." },
      { title: "Publish", body: "Set Active, then publish the site. It’s live on the shop page." },
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
