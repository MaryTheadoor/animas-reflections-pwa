/**
 * Admin help content — the searchable user guide + step-by-step tutorials.
 * Rendered by <HelpGuide /> in the admin "Help" tab.
 *
 * Originally ported from the Content & Theme line (origin/master, commit 4a23bc3),
 * which had it live before that deployment was overwritten. The two lines were
 * then reconciled (docs/STATUS_SWEEP.md §1, docs/DEVLOG.md Session 35), so the
 * "features only on the other line" caveats are long gone.
 *
 * MAINTENANCE: this file must describe what the admin actually does. It has twice
 * drifted — entries describing features that did not exist, and entries missing
 * features that did — and a guide that lies is worse than no guide, because the
 * admin trusts it and stops looking. When you change a tab, a button label or a
 * workflow, update the entry in the same commit. Reviewed against the deployed
 * admin on 2026-10-13 (Session 37 batch: photo library, matrix fill, auto-pin,
 * bulk updates).
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
    keywords: ["welcome", "start", "overview", "admin", "dashboard", "tabs", "refresh"],
    body: "The Admin dashboard is where you run the whole store.\n\nThe tabs across the top are: Products, Categories, SEO, Settings, Designs, Images, Product Photos, Orders, Users, Admins, Content & Theme, and Help.\n\nStart by opening the Products tab and turning on the shop: add a product (name, category, and at least one variant with a price), then set it Active. The public storefront updates automatically once the site is published.\n\nWord, colour and font changes live in Content & Theme; per-page titles and descriptions live in SEO.\n\nIf a change you made does not appear, reload the page; a hard refresh (Ctrl+Shift+R) is only needed if the browser is holding an old copy. The site keeps an offline cache so it opens without a network, but it now always loads the current build first, so a returning visit can no longer show you a previous version.",
  },
  {
    id: "help",
    title: "Using this guide",
    category: "Basics",
    keywords: ["help", "guide", "search", "tutorial", "documentation", "how do i"],
    body: "This tab is the admin guide. Type in the search box to filter entries — the search looks at titles, bodies and keywords, so “price”, “merge” or “mockup” all work.\n\nEntries are grouped by area: Basics, Products, Catalog, Storefront and Admin. Below them are step-by-step tutorials that walk a whole job end to end, such as migrating a catalog from Square or reusing a blank garment's photos.\n\nIf something here does not match what you see on screen, that is a documentation bug worth reporting — the guide is expected to track the admin exactly.",
  },

  /* ── Products ──────────────────────────────────────────────────────────── */
  {
    id: "products",
    title: "Manage products",
    category: "Products",
    keywords: ["product", "add", "edit", "delete", "price", "active", "featured", "sku", "customizable", "clone"],
    body: "In Products, click “+ New Product” (or an existing product) to open the editor.\n\nRequired: Name, Category, and at least one Variant with a price. The Save button stays disabled until those are filled.\n\nToggle Active to show/hide the product on the storefront, and Featured to pin it to the homepage.\n\nEverything else lives in the same editor, in this order: description (with formatting — see the description entry), images, colours, print zones, the variant matrix, add-ons, and Printable Designs. Payment shipping can be overridden per product with its own flat rate.\n\nDuplicate an existing product to start from a similar one rather than from scratch.",
  },
  {
    id: "variants",
    title: "Variants, options & inventory",
    category: "Products",
    keywords: ["variant", "size", "sku", "inventory", "stock", "out of stock", "matrix", "bulk add", "fill"],
    body: "Variants are the specific versions you sell, e.g. “Large / Navy”. Each has a name, price, SKU, and optional inventory count.\n\nUse the Variant Matrix to add size/colour combinations. You do not have to click every cell: set the Base Price first, then Add all in view creates the cells on screen, and Add every combination creates the whole grid when a third dimension (say Fit) is in play. Apply this price to all pushes the base price onto variants you have already created. Remove all in view clears the view. Before a batch over twenty you are asked to confirm, and the result is reported.\n\nThe matrix builds itself from the colours and sizes in Settings → Catalog Options, or from option dimensions defined on the product if it has any.\n\nSet Inventory per variant. Inventory drives the stock badges on the shop page and the availability flag in the page's structured data — it is a display and search signal, not a hard sales block. A product with no inventory recorded is treated as available.",
  },
  {
    id: "descriptions",
    title: "Product descriptions & formatting",
    category: "Products",
    keywords: ["description", "rich text", "bold", "italic", "heading", "link", "list", "format"],
    body: "The product editor's description field is a rich-text editor: select text and use the toolbar for Bold, Italic, a bullet or numbered list, or a heading (H2/H3). A link button turns the selection into a link, and a clear button removes formatting.\n\nThe formatting is stored with the product and rendered on the product page. Only a safe subset of tags survives — headings, paragraphs, lists, links, bold and italic — so pasting from a word processor will not carry its own styles through.\n\nKeep the first sentence self-contained: search engines and the shop card use the opening of the description as a summary.",
  },
  {
    id: "colors",
    title: "Colors & swatches",
    category: "Products",
    keywords: ["color", "swatch", "hex", "tint", "color images", "palette"],
    body: "The list of site colours (plus sizes and product types) lives in Settings → Catalog Options. In a product's editor, tick the colours that product is sold in, or type a custom colour name for that one product. A custom colour can be promoted into the site-wide library so every product can use it.\n\nEach colour carries a swatch hex and optionally its own photos in the “Color Images” section, so the product page and the customizer show the right look when a customer picks that colour.\n\nColours are matched by name, exactly as written. If a colour appears twice with different capitalisation, it is two colours to the system.",
  },
  {
    id: "modifiers",
    title: "Add-ons",
    category: "Products",
    keywords: ["addon", "modifier", "personalization", "back print", "sleeve", "toggle", "text", "file", "square"],
    body: "Add-ons are the extras a customer can add: Back Print, Sleeve Print, Name/Number, etc.\n\nEach add-on has a price (Fixed $ or % of base) and an input type: Toggle (price only), Text (e.g. a name/number), or File (custom artwork upload).\n\nGrouping and reuse: “Apply an existing set” lists the modifier sets already in use across your catalogue — pick one and its choices are added to this product, skipping any it already has. Each modifier's Group field suggests those same set names as you type, so one set stops being spelled three ways. Modifiers sharing a group render together in the customizer.\n\nA product can use the site-wide default add-ons, opt out entirely, or define its own set with editable prices.\n\nIn Square, add-ons are “modifier sets”, kept separately from items and with no export of their own. The CSV import records which sets each item uses; “Import Square add-ons” then reads their choices and prices from Square and attaches them here, grouped by set name. See the migration entry for the full order of operations.",
  },
  {
    id: "duplicates",
    title: "Finding and merging duplicate products",
    category: "Products",
    keywords: ["duplicate", "merge", "same product", "redundant", "cleanup", "twice"],
    body: "Products tab → Find duplicates. Two products count as duplicates when the name and every variant (name, price, SKU) match; variant order does not matter.\n\nEach group can be merged on its own, or tick groups and use Merge selected (N), or Merge all to clear everything found in one go. Merging keeps the most complete copy, combines what the others held — images, colours, tags, designs — and deletes the redundant products.\n\nA merge is not reversible, and it reports what it kept. Read the groups before using Merge all; two genuinely different products can share a name and variant list, and only you know whether that is intended.\n\nIf copies disagree about inventory, the highest count per variant is kept, and the confirmation says so.",
  },
  {
    id: "bulk-updates",
    title: "Updating many products at once",
    category: "Products",
    keywords: ["bulk", "batch", "many products", "update", "price change", "apply", "mass update"],
    body: "Products tab → Bulk update products. Two operations: apply a saved blank product's photos to many products, or set one price across many variants.\n\nPick a category or a product type to narrow the targets, then Preview. The preview lists exactly which products change, how much changes on each, and which views the blank has no photo for — nothing is written until you press Apply, and Apply does only what the preview showed.\n\nA product that already matches is left out rather than listed, so running the same update twice reports nothing to do the second time. Applying photos merges per view, so a mockup you set by hand on another view is never overwritten. Failures are listed per product instead of being swallowed.",
  },

  /* ── Catalog ───────────────────────────────────────────────────────────── */
  {
    id: "product-photos",
    title: "The product photo library",
    category: "Catalog",
    keywords: ["product photos", "library", "blank", "mockup", "reuse", "upload once", "view", "front", "back", "sleeve", "apply"],
    body: "Product Photos is a library of blank-product photos — the plain garment, mug or sign with nothing printed on it. Upload one once and reuse it on every product that uses the same item, instead of uploading the same five photos over and over.\n\nA photo records which BLANK PRODUCT it is and which VIEW it is. It can also carry an optional Modifier: tag a photo with a modifier name and, when a customer selects that modifier in the customizer, that photo becomes the background for its view — the “background image with a design printed on top” case (for example a back view that shows the print the customer just chose). The blank product is its name (for example “Gildan 18500 Hoodie”), and the view is one of Front, Back, Sleeve, Left side or Right side. Photos sharing a blank name form one set.\n\nUploading. Choose the blank product name, then select several images at once. Leave View on “Auto” and each file's view is read from its filename — gildan-front.png, gildan_back.png, gildan-sleeve.png — and the form shows what it worked out for each file before anything is uploaded. Set View explicitly if your filenames do not say. Colour is optional: leave it blank for a general photo that gets tinted for whichever colour the customer picks, or set it for a photo taken of one specific colour. Product type and categories are optional filters, and Tags are for searching.\n\nUsing it. In a product's editor, under Mockup Images, the “Apply a saved blank product” buttons fill that product's mockup views: one click sets Front, Back and Sleeve instead of three uploads. Each button says how many of the five views the blank covers, and after applying you are told which views are still missing rather than being left to find out in the customizer. The list is filtered to blanks that suit the product (matching type, or a category the blank declares), with “Show all blanks” to override.\n\nFor the gallery — the photos on the shop card and product page — use “Add from the photo library” under Images in the product editor: search, tick several, and they are added without re-uploading.\n\nEditing. Any photo's name, view, colour, type, categories and tags can be changed later, and its image replaced. Deleting a photo removes the stored file too.\n\nDo not confuse this with the Images tab, which manages ONE product's own photos. This is the shared library those products draw from. To apply a blank to many products at once, use Bulk update.",
  },
  {
    id: "images",
    title: "Images & per-product photos",
    category: "Catalog",
    keywords: ["image", "photo", "upload", "gallery", "mockup", "color image", "images tab"],
    body: "The Images tab manages the photos belonging to one product: choose the product, then upload and arrange them.\n\nThere are three kinds of image on a product. Gallery images are the general photos of the finished item, used on the shop card and the product page. Mockup images are the blank-product shots for each view (Front, Back, Sleeve, Left, Right) that the customizer places a design onto. Colour images are per-colour photos that replace the tinted mockup when a customer picks that colour.\n\nYou can upload these in the product editor directly, or pick them from the shared Product Photos library so the same blank garment is uploaded once for every product that uses it — see the product photo library entry.\n\nUploading through the product editor for a product that has not been saved yet puts the file in a temporary folder; save the product and the images stay with it.",
  },
  {
    id: "designs",
    title: "The design library",
    category: "Catalog",
    keywords: ["design", "artwork", "logo", "printable", "library", "upload", "auto", "pin", "category"],
    body: "Designs are reusable graphics customers can print on products.\n\nAdd designs in the Designs tab: name, a category label, tags, an optional description, and the image. The category label is free text and is what customers search by.\n\nPinning. In a product's editor, pin “Printable Designs” so they appear first (the limit is the site's design limit, set in Settings and defaulting to 25) in that product's customizer. Designs are stored once and shared, but a product keeps its own copy of the details — so after renaming a design or replacing its image, use “Refresh pinned from library” on the affected product, or simply save the product, which re-reads them for you.\n\nGroup selection. Above the grid, “Add a design group” is a dropdown of your groups — the same categories the shop browses by. Pick one and every design in it is pinned at once, and the option shows how many designs it holds, so an empty group is visible before you choose it. Individual designs can still be pinned or unpinned in the grid below, which is the only place you can see what is being pinned.\n\nDesign Your Own. A product whose Category is “Design Your Own” takes the customer's own artwork, so the printable-design controls are replaced by a design upload: attach the file and it is recorded against that one product. Standard products keep the full design library.\n\nAutomatic pinning. Below the category label, the Designs editor lists your real categories with tick boxes. Tick one and every NEW product in that category gets the design pinned without you choosing it; the editor tells you how many it pinned. Deselecting one by hand is remembered — it will not come back. Existing products are never changed automatically: for those, use “Pin this category's designs” in the affected product.\n\nA design with nothing ticked still pins if its category label, or one of its tags, matches a category's name — those categories are marked “≈” in the picker so you can see why. Tick a category explicitly to take control; leave the list empty on purpose to opt a design out of automatic pinning entirely.\n\nDesigns are stored once and reused across any product. The Designs tab also has a “Migrate Old Data” action for the legacy flat format.",
  },
  {
    id: "print-zones",
    title: "Print zones & garment mockups",
    category: "Catalog",
    keywords: ["print zone", "mockup", "printable", "print area", "customizer", "zone", "drag", "resize"],
    body: "A print zone is the printable area on a garment view (front, back, sleeve, left/right side). It is stored as percentages of the mockup, so it scales with the image.\n\nIn the product editor → Print Zones, the zone is drawn over the product's mockup: drag it to move, drag its handles to resize. The percentages update as you work, and can be typed directly if you prefer.\n\nIf a view has no zone, the customizer falls back to a default, which usually needs adjusting — a design that floats off the garment is a missing or oversized zone, not a broken design.\n\nA zone needs a mockup photo to be visible: upload one in the product editor, the Images tab, or pick a blank from the Product Photos library.",
  },
  {
    id: "categories",
    title: "Categories & organizing the shop",
    category: "Catalog",
    keywords: ["category", "subcategory", "parent", "organize", "nav", "order", "shop"],
    body: "Categories group products for the shop, the navigation and the filters.\n\nCreate and reorder them in the Categories tab. A category can sit under another as a subcategory, so “Durango High Football” can live inside “Teams”; that hierarchy is what the shop's brand browsing and the storefront navigation follow.\n\nCategories drive the “By Brand / Category” browse mode on the shop page, the featured-category filters on the fundraising page, and the automatic design pinning described in the design library entry.\n\nA product belongs to one category (its Category field), so a product that fits two places should be filed where a customer would look for it first. The import can create categories for you from a spreadsheet — see the migration entry.",
  },
  {
    id: "catalog-import",
    title: "Migrating a catalog from Square",
    category: "Catalog",
    keywords: ["import", "csv", "migrate", "migration", "square", "export", "spreadsheet", "bulk", "upload", "catalog"],
    body: "You can bring an existing Square catalog in from a spreadsheet instead of retyping every product.\n\n1. Export from Square. In the Square Dashboard, export your item library to CSV. If you sell the same catalog in person, the export may include POS-only items — the website products are the ones marked visible online, so filter to those first.\n\n2. Check the sheet. One row per variant. Rows that share the same product name are grouped into one product with several variants. Every row needs a name, and any row with variant data needs a price. Our template column names work, and Square's own export column names are accepted as-is (item_name, variation_name, item_price, item_sku), so a raw Square export can normally be uploaded unchanged.\n\nOptional columns: sku, inventory, colors (semicolon- or pipe-separated), category, productType, description, active, featured, image (plus image2 and image3), seoTitle, seoDescription.\n\n3. Create the categories first — or let the import make them. The import matches the category names in your sheet against the categories you already have in the Categories tab. Tick “Create missing categories” and it will also create any it cannot match (choosing the deepest level of a path like “Bands > LITTLE STRANGER” and ignoring the trailing Square id). Leave it unticked and unmatched names are only reported, which is safer if the sheet contains internal buckets like “Fundraising Pricing”, “Custom”, “Donation” or “Shipping” that should not become categories. Either way the report lists every name it could not place.\n\n4. Import. Products → Import CSV → choose your file. “Download template” gives you a starter file with the right column names.\n\n5. Read the report. You get how many products were created, updated, and matched an existing product; a “Needs your attention” list (unmatched categories, columns that mapped to nothing, product types that fell back to “other”); and any rows that failed outright.\n\n6. Correct and re-import. Re-uploading the same file updates the same products rather than creating duplicates, so the usual loop is: fix the spreadsheet, upload again, check the report.\n\n7. Bring the add-ons across. Square keeps add-ons (modifier sets) separately from items and offers no export for them, so the sheet records only WHICH sets each product uses. After importing, click “Import Square add-ons” and the choices and prices are read from Square and attached, grouped under each set's name. Run the import first — the add-on step needs the spreadsheet to have recorded the associations.\n\n8. Photos. The import can only place images by URL; it cannot upload files. After importing, attach the blank-product photos from the Product Photos library, which is faster than uploading them per product.\n\nWhat the import works out for you: if a variant label names a size or a colour (“L / Navy”, “X-Large”, “3””), those dimensions are built on the product and each variant is mapped into them, so the variant matrix shows real Size and Color columns. And if a product name matches one of your brands (Biscuit Hockey, LITTLE STRANGER, Durango Hockey, Drink Huggers and so on), that brand is used as the category when the sheet does not name one. Archived items import as inactive, stock and weight come across, and each variant keeps its Square variation id. Anything it could not work out — a variant label with no recognisable size or colour, a brand category that does not exist yet, a product type it had to guess, two Square sets sharing a name — is listed in the report so you can finish it by hand.",
  },

  /* ── Storefront ────────────────────────────────────────────────────────── */
  {
    id: "customizer",
    title: "The design customizer",
    category: "Storefront",
    keywords: ["customizer", "customize", "design", "mockup", "print zone", "add to cart"],
    body: "Customers open the customizer from a product (“Customize This”, shown when the product is marked customizable). They pick a colour, then drag, resize and rotate a design or text within the print zone, add optional add-ons, and add to cart.\n\nThe design list shows that product's pinned designs first, then the rest of the library. What a customer produces — the design, its position and scale, and any text — is saved with the order, so it can be opened from the Orders tab for printing.\n\nProducts need a colour and a print zone to preview correctly, and a mockup photo for each view. Designs and add-ons are managed in the admin.",
  },
  {
    id: "checkout",
    title: "Checkout & payments (Square)",
    category: "Storefront",
    keywords: ["checkout", "square", "payment", "card", "shipping", "tax", "cart"],
    body: "Checkout uses Square to securely take payment. Prices, add-ons, and shipping are re-priced server-side to prevent tampering, so what a customer pays always matches what the server calculates rather than what the browser sent.\n\nShipping tiers and the free-shipping threshold are set in Settings, and an individual product can override shipping with its own flat rate.\n\nOrders are mirrored to Firestore and appear under Orders.",
  },
  {
    id: "orders",
    title: "Orders & fulfillment",
    category: "Storefront",
    keywords: ["order", "fulfillment", "tracking", "shipped", "customer", "square order", "design files"],
    body: "Orders appear in the Orders tab with customer info, line items, design files, and totals. Square orders are merged with the Firestore order mirror so nothing from a manual order is lost.\n\nAdd a tracking number/URL to an order to update its status, and open the saved design files from the order row for printing.\n\nOrders are matched to customer accounts by email.",
  },

  /* ── Admin ─────────────────────────────────────────────────────────────── */
  {
    id: "users-admins",
    title: "Users, accounts & admin access",
    category: "Admin",
    keywords: ["user", "admin", "access", "login", "role", "email", "invite"],
    body: "Customers create accounts to see their orders and saved addresses.\n\nAdmins are controlled by the allowlist in the Admins tab. Only emails in that list can access the admin dashboard and upload product photos — add or remove admins there. This is the secure way to grant access (never rely on an email domain alone).\n\nRemoving an address takes effect on that person's next sign-in, so use it deliberately.",
  },
  {
    id: "settings",
    title: "Site settings & catalog options",
    category: "Admin",
    keywords: ["settings", "sizes", "product types", "shipping", "catalog options", "threshold", "add-on price"],
    body: "Settings controls store-wide options: the shipping tiers and free-shipping threshold, the default add-on price, the customer fields collected at checkout, and the Catalog Options (the colours, sizes and product types a product can use, plus the default add-ons).\n\nThe colours and sizes here are what the variant matrix offers, and the product types here are what the shop's type filter lists — so adding one makes it available everywhere it is offered.\n\nBrand colours, fonts and all site copy are edited in the Content & Theme tab instead.",
  },
  {
    id: "content-theme",
    title: "Editing site copy, colours & fonts",
    category: "Admin",
    keywords: ["copy", "content", "text", "wording", "theme", "colors", "colours", "font", "dark mode", "announcement", "contrast", "accessibility"],
    body: "The Content & Theme tab is where the site's words, colours and fonts are edited. It is the ONLY place they live — the Settings tab used to carry duplicates of these controls, and every one of them was dead.\n\nCopy — pick a page (Home, About, Contact, FAQ, Fundraising, Terms, Privacy, Biscuit Hockey, I'M OK R U, Navigation, Global), then edit its fields. Each field has a Reset that restores the built-in wording, and \"+\" adds a row to the repeatable lists (FAQ questions, Terms/Privacy sections, fundraising steps). Saving is instant: the storefront reads the copy live, with no rebuild.\n\nTheme — Light and Dark sub-tabs, a colour picker plus hex box per token, and font dropdowns. Edits preview on the page as you change them; Save applies them everywhere.\n\nThe contrast floor: if a colour you pick cannot be read on its background (WCAG AA, 4.5:1), it is not published as-is. The readable default is used instead and a note appears listing what changed and why, so the site cannot end up with unreadable text. A mid-tone surface cannot carry the accent colours at all — if you go darker or lighter than the default, check the storefront rather than only the preview box.\n\nPage titles and meta descriptions are NOT here — they are per-page and live in the SEO tab. Changes appear immediately for visitors. The site keeps an offline cache so it opens without a network; it always loads the current build first, so a visitor no longer sees a previous version after an update.",
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
    id: "getting-started",
    title: "Getting started",
    description: "Publish your first products and turn on the storefront.",
    steps: [
      { title: "Add a category", body: "Categories → + New Category. Categories group products on the shop page, and can be nested if you want subcategories." },
      { title: "Create a product", body: "Products → + New Product. Add a name, pick the category, and set a price." },
      { title: "Add variants", body: "Use the Variant Matrix: set the Base Price, then Add all in view. Enter inventory per variant so customers see stock badges." },
      { title: "Add photos", body: "Upload the blank product's photos once in Product Photos, then apply that blank in the product editor to fill every view." },
      { title: "Publish", body: "Set the product Active. It appears on the storefront once the site is published, and hard-refresh if you do not see it." },
    ],
  },
  {
    id: "reuse-blank-photos",
    title: "Reuse one blank product's photos everywhere",
    description: "Upload a garment's photos once, then apply them to every product that uses it.",
    steps: [
      { title: "Photograph the blank", body: "Take the shots you need of the plain item — front, back, sleeve, left and right. Name the files so the view is obvious: gildan-18500-front.png, gildan-18500-back.png." },
      { title: "Upload them together", body: "Product Photos → type the blank product's name (“Gildan 18500 Hoodie”), leave View on Auto, and select all the files at once. The form shows which view each file will be filed as before you upload." },
      { title: "Tag them", body: "Set the product type (Apparel, say) and tick any categories the blank suits. This is what makes the right blanks appear first in a product's editor. Leave Colour blank for a general photo that gets tinted per colour; set it for photos of one specific colour." },
      { title: "Apply it to a product", body: "Open a product → Mockup Images → click the blank's button. Every view it has is filled in one click, and the note tells you which views are still missing." },
      { title: "Use it for the gallery too", body: "Under Images in the same editor, “Add from the photo library” adds existing photos to the product's gallery without another upload." },
      { title: "Repeat for the catalog", body: "For products you already created, Products → Bulk update products lets you apply the blank across a whole category at once. Preview first — it lists exactly what will change." },
      { title: "Keep it current", body: "Replaced a photo, or re-shot the blank? Edit the library entry — the products that pinned it keep their own copy, so save the affected products (or use Refresh pinned designs for designs) rather than assuming the change propagated." },
    ],
  },
  {
    id: "add-product-variants",
    title: "Add a product with color/size variants",
    description: "A worked example for a T-shirt sold in sizes and colors.",
    steps: [
      { title: "Create the product", body: "Name: “Classic Tee”, Category: Apparel, Type: Apparel." },
      { title: "Pick colors", body: "Select the colors this product is sold in, or type a custom color name for just this product." },
      { title: "Build the matrix", body: "Set the Base Price, then Add all in view to create every size/colour cell at once. Change the price and use Apply this price to all if it should be uniform." },
      { title: "Set inventory", body: "Enter stock per variant. It drives the stock badges customers see." },
      { title: "Add photos", body: "Apply a saved blank from Product Photos to fill the mockups, and assign per-color color images so each colour shows its own photo." },
      { title: "Publish", body: "Set Active, then publish the site. It's live on the shop page." },
    ],
  },
  {
    id: "migrate-from-square",
    title: "Migrate a catalog from Square",
    description: "Export your Square items, tidy the sheet, and bring them in here.",
    steps: [
      { title: "Export from Square", body: "In the Square Dashboard, export your item library to a CSV file. If you also sell in person, filter out POS-only items first — the website products are the ones marked visible online." },
      { title: "Decide about categories", body: "Either add every category your sheet refers to in the Categories tab first, spelled as the sheet spells them, or tick “Create missing categories” during the import. Creating them up front is safer if your sheet contains internal buckets like “Shipping” or “Donation”." },
      { title: "Check the sheet", body: "One row per variant; rows sharing a product name become one product. Every row needs a name, and any row with variant data needs a price. Square's own column names are accepted, so the export usually works as-is." },
      { title: "Import", body: "Products → Import CSV → choose your file. Use Download template if you are building a sheet from scratch." },
      { title: "Read the report", body: "Check the created/updated counts, then the “Needs your attention” list: unmatched categories, columns that mapped to nothing, and product types that fell back to “other”. Failed rows are listed separately." },
      { title: "Correct and re-import", body: "Fix the spreadsheet and upload it again. Re-importing updates the same products rather than duplicating them, so repeat until the report is clean." },
      { title: "Bring the add-ons across", body: "Click Import Square add-ons. The sheet recorded which add-on sets each product uses; this reads their choices and prices from Square and attaches them, grouped by set name." },
      { title: "Add the photos", body: "The sheet can only carry image URLs, so upload the blank garments in Product Photos and apply them, or use Bulk update to do a whole category at once." },
      { title: "Tidy up per product", body: "Sizes and colours are worked out from your variant labels automatically, and a product name that matches one of your brands is filed under that brand's category. Anything the import could not work out is listed in the report — finish those by hand in the product editor." },
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
