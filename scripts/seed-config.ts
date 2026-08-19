import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ projectId: "animas-reflections-pwa" });

const db = getFirestore();

const DEFAULT_CONFIG = {
  announcement_text: "Family Owned & Operated From Durango, CO USA — Free shipping on orders over $100",
  announcement_active: true,
  primary_color: "#1E4D4F",
  accent_color: "#D97706",
  background_color: "#FAF6F0",
  gold_color: "#D97706",
  plum_color: "#935B8A",
  cream_color: "#FAF6F0",
  warm_sand_color: "#F5EBE6",
  text_color: "#111827",
  heading_font: "Georgia, 'Times New Roman', serif",
  body_font: "system-ui, -apple-system, sans-serif",
  shipping_tier_stickers: 3.0,
  shipping_tier_apparel: 7.5,
  free_shipping_threshold: 100.0,
  addon_price: 5.0,
  hero_heading: "Custom Designs On An Array Of Products",
  hero_subheading: "Discover Endless Possibilities With Our Custom Designs Printed On An Array Of Products",
  about_heading: "From Our Family To Yours",
  about_body: "At Animas Reflections, we are a family-owned and operated design & print operation based in Durango, CO.",
  fundraising_heading: "Fundraising Made Easy",
  fundraising_subheading: "Raise money for your team, school, or cause with custom merchandise.",
  footer_tagline: "Family owned and operated design & print operation based in Durango, CO.",
  catalog_options: {
    colors: [
      { name: "Black", hex: "#000000" },
      { name: "White", hex: "#FFFFFF" },
      { name: "Navy", hex: "#1E3A5F" },
      { name: "Heather Grey", hex: "#9CA3AF" },
      { name: "Charcoal", hex: "#4B5563" },
      { name: "Royal Blue", hex: "#2563EB" },
      { name: "Red", hex: "#DC2626" },
      { name: "Forest Green", hex: "#166534" },
      { name: "Maroon", hex: "#7F1D1D" },
      { name: "Sand", hex: "#D4A574" },
    ],
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"],
    productTypes: [
      { value: "apparel", label: "Apparel" },
      { value: "sticker", label: "Sticker / Slap" },
      { value: "sign", label: "Wood Sign" },
      { value: "jewelry", label: "Jewelry" },
      { value: "accessory", label: "Accessory" },
      { value: "other", label: "Other" },
    ],
    customOptionNames: [],
  },
  addon_defaults: {
    defaultPriceType: "fixed",
    defaultPrice: 5.0,
    standardAddons: [
      { id: "back_print", name: "Back Print", priceType: "fixed", price: 5.0 },
      { id: "sleeve_print", name: "Sleeve Print", priceType: "fixed", price: 5.0 },
      { id: "personalization", name: "Name/Number", priceType: "fixed", price: 5.0 },
    ],
  },
  customer_fields: [
    { id: "firstName", label: "First Name", type: "text", required: true, squareMapping: "recipient.name" },
    { id: "lastName", label: "Last Name", type: "text", required: false },
    { id: "email", label: "Email", type: "email", required: true, squareMapping: "recipient.emailAddress" },
    { id: "phone", label: "Phone", type: "tel", required: false, squareMapping: "recipient.phoneNumber" },
    { id: "address", label: "Street Address", type: "text", required: true, squareMapping: "recipient.address.addressLine1" },
    { id: "city", label: "City", type: "text", required: true, squareMapping: "recipient.address.locality" },
    { id: "state", label: "State", type: "text", required: false, squareMapping: "recipient.address.administrativeDistrictLevel1" },
    { id: "zip", label: "ZIP Code", type: "text", required: true, squareMapping: "recipient.address.postalCode" },
  ],
};

async function seedConfig() {
  try {
    const configRef = db.collection("config").doc("site");
    const doc = await configRef.get();
    
    if (doc.exists) {
      console.log("Config already exists. Merging with defaults...");
      await configRef.set(DEFAULT_CONFIG, { merge: true });
    } else {
      console.log("Creating new config with defaults...");
      await configRef.set(DEFAULT_CONFIG);
    }
    
    console.log("✓ Config seeded successfully");
  } catch (error) {
    console.error("Error seeding config:", error);
    process.exit(1);
  }
}

seedConfig();
