/* ─── Animas Reflections — Site Copy ─────────────────────────────────
   Centralized content extracted from existing animasreflections.com
   All text copy lives here; components reference this data.
   ────────────────────────────────────────────────────────────────── */

export const SITE = {
  name: "Animas Reflections",
  tagline: "From Our Family To Yours",
  phone: "970-769-2779",
  email: "AnimasReflections@gmail.com",
  location: "Durango, Colorado, USA",
  founded: 1999,
  description:
    "Family owned and operated design & print operation based in Durango, CO, creating unique custom designs inspired by the beauty of Southwest Colorado since 1999.",
} as const;

export const NAVIGATION = {
  primary: [
    { label: "Shop", href: "/shop" },
    { label: "Customizer", href: "/customizer" },
    { label: "Our Story", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  secondary: [],
  footer: [
    { label: "Shop All", href: "/shop" },
    { label: "Customizer", href: "/customizer" },
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Terms of Sale", href: "/terms" },
  ],
} as const;

export const HERO = {
  heading: "Custom Designs On An Array Of Products",
  subheading: "Discover Endless Possibilities With Our Custom Designs Printed On An Array Of Products",
  cta_primary: { label: "Design Your Own", href: "/custom" },
  cta_secondary: { label: "Browse Catalog", href: "/shop" },
} as const;

export const ANNOUNCEMENT = {
  text: "Family Owned & Operated From Durango, CO USA — Free shipping on orders over $100",
  active: true,
} as const;

export const DESIGN_YOUR_OWN = {
  heading: "Design Your Own",
  body: `Put your own image on just about anything. If you do not see what you are looking for, contact us and we'll find it! Do you have an old favorite t-shirt that's falling apart, your favorite gaming character that you can't find, or your own funny idea? We can recreate it! We can put your own original print on glass, metal, wood, slate, clothing, and much more. Businesses, family reunions, sports teams, weddings, birthdays, graduations — the possibilities are endless. Email your image to ${SITE.email}. Choose what you want it printed on. It's that easy!`,
} as const;

export const OUR_STORY = {
  heading: "Our Story",
  subheading: "From Our Family To Yours",
  body: `At Animas Reflections, we are a family-owned and operated design & print operation based in Durango, CO. We have been creating unique designs inspired by the beauty of Southwest Colorado since 1999 when my husband and I were married. Over the years, our family grew with the addition of our son and daughter. Our creations range from monthly concert tees to jewelry that captures the energy and beauty of nature. With sublimation and direct to film printing technology, we can customize various items like glassware, metal accents, apparel, hats, and more! If you have an idea in mind, we'll bring it to life for your business or family needs. We can organize fundraisers for teams or businesses. We take pride in offering high-quality merchandise that stands out from the rest.`,
} as const;

export const BISCUIT_HOCKEY = {
  heading: "Biscuit Hockey",
  subheading: "A Division of Animas Reflections",
  body: `Biscuit Hockey was established in March 2021. My husband's connection with hockey dates back to his early childhood in the 70s. We have cherished photographs from his Grandma capturing his journey of learning how to skate on the frozen ponds of Madison, WI while using a chair for support. Hockey possesses its own unique language that one can only acquire by growing up playing it. Our collection features his favorite sayings from this remarkable language. If you live and breathe hockey, you'll truly appreciate it. Pass that Biscuit and keep the game alive!`,
} as const;

export const IM_OK_R_U = {
  heading: "I'M OK R U",
  subheading: "A Subsidiary of Animas Reflections",
  body: `Born on the Spring Solstice of 2021, a time symbolizing renewal and growth. After an arduous year in 2020, we all deserve a fresh start. During my personal journey, I found solace in small reminders to overcome negativity and despair. To share this positivity subtly yet meaningfully with others, I began designing shirts that carried hidden messages only discerning eyes could see. These messages serve as personal reminders for challenging days — to pause, breathe deeply, envision success and release stress gracefully. With practice and determination, we gain control over the inevitable pressures we encounter daily. Remember that our reactions shape our experiences; so take a moment to BREATHE & THINK before responding.`,
} as const;

export const FEATURED_PRODUCTS = {
  heading: "Featured Items",
  subheading: "Discover our diverse collection now and find your perfect style",
  items: [
    { name: "Custom Designed T-shirt", priceDisplay: "$20.00" },
    { name: "2 Inch Slaps", priceDisplay: "$0.54 – $0.77" },
    { name: "Vapor Apparel Products", priceDisplay: "See it in Action" },
    { name: "Personalized Chromaluxe HD Metal Panels", priceDisplay: "Contact Us For Affordable Pricing" },
    { name: "Personalized Pet Products", priceDisplay: "Contact Us For Affordable Pricing" },
    { name: "Personalized Auto Products", priceDisplay: "Contact Us For Affordable Pricing" },
    { name: "ChromaLuxe Wood Panels", priceDisplay: "Contact Us For Affordable Pricing" },
  ],
} as const;

export const CATEGORIES = {
  heading: "Featured Categories",
  subheading: "Our latest collections are full of items you will love",
  items: [
    "Animas Reflections",
    "I'M OK R U",
    "Biscuit Hockey",
    "Durango Lacrosse",
    "Custom Designs",
    "Jewelry",
    "Custom Slaps",
  ],
} as const;

export const CONTACT = {
  heading: "Contact Us",
  subheading: "Reach out and let us know if there is anything we can do for you.",
  phone: SITE.phone,
  email: SITE.email,
  location: SITE.location,
  privacy_note:
    "You may receive marketing and promotional materials. Contact the merchant for their privacy practices.",
} as const;

export const TERMS_OF_SALE = {
  heading: "Standard Terms of Sale",
  subheading: "FOB Origin — Effective Date: March 2021",
  sections: [
    {
      title: "1. General Terms",
      body: `All sales made by Animas Reflections ("Seller," "we," or "our") through our website or any affiliated online platform constitute acceptance of these Standard Terms of Sale ("Terms"). By purchasing products from Animas Reflections, the buyer ("Customer," "you," or "your") agrees to these Terms in full. These Terms supersede any prior or conflicting terms, unless otherwise agreed to in writing and signed by an authorized representative of Animas Reflections.`,
    },
    {
      title: "2. Pricing and Payment",
      body: `All prices are listed in U.S. dollars (USD) and are subject to change without notice. Prices do not include taxes, shipping, or handling fees unless expressly stated. Applicable sales tax will be calculated at checkout based on delivery location and current tax laws. Payment in full is required at the time of purchase. Accepted payment methods are those displayed on our online checkout page (including major credit/debit cards, PayPal, or other approved processors). Animas Reflections reserves the right to cancel or refuse any order if payment cannot be verified or is suspected of fraud.`,
    },
    {
      title: "3. Order Processing and Acceptance",
      body: `Once an order is placed, you will receive an order confirmation email. This confirmation does not constitute acceptance of the order but serves as acknowledgment that it was received. Orders are accepted and processed once payment has cleared and inventory availability is confirmed. We reserve the right to cancel or adjust orders in cases of product unavailability, pricing errors, or other issues beyond our control.`,
    },
    {
      title: "4. Shipping Terms — FOB Origin (Durango, Colorado)",
      body: `All physical shipments are made FOB Origin — Durango, Colorado, meaning title and risk of loss transfer to the Customer once the product is handed over to the carrier. The Customer is responsible for all shipping, handling, and insurance costs. Unless otherwise specified by the Customer, Animas Reflections will arrange shipment through a carrier of its choosing. Estimated shipping times are provided for convenience and are not guaranteed. Delays due to carriers, weather, or other external factors are beyond our control. For local customers, in-person pickup or local delivery options may be arranged when available.`,
    },
    {
      title: "5. Digital Products (if applicable)",
      body: `Digital goods (such as downloadable files, media, or online access products) are delivered electronically after payment has been processed. Digital purchases are non-refundable once delivery (e.g., download link or access credentials) has been provided. The Customer is responsible for ensuring compatible hardware and software for accessing digital products. Unauthorized sharing, copying, or redistribution of digital content is strictly prohibited and may result in legal action.`,
    },
    {
      title: "6. Inspection and Acceptance of Goods",
      body: `The Customer must inspect all physical goods upon delivery. Any claims for damage, shortage, or defects must be made within five (5) business days of receipt. Failure to notify Animas Reflections within that time constitutes full acceptance of the goods and waiver of any claims.`,
    },
    {
      title: "7. Returns and Exchanges",
      body: `Returns are accepted only with prior written authorization from Animas Reflections. Returned products must be unused, in their original condition and packaging, and accompanied by proof of purchase. Customers are responsible for all return shipping costs unless the product was defective or shipped in error. Custom, personalized, and digital products are non-returnable except in the case of documented defect or fulfillment error. Approved refunds will be issued to the original payment method after inspection of the returned item.`,
    },
    {
      title: "8. Warranties",
      body: `Unless otherwise stated in writing, all products are sold "as is" without express or implied warranties, including any implied warranty of merchantability or fitness for a particular purpose.`,
    },
    {
      title: "9. Limitation of Liability",
      body: `To the fullest extent permitted by law, Animas Reflections shall not be liable for any indirect, incidental, special, or consequential damages, including loss of profits or business interruption. Our total liability shall not exceed the purchase price of the item(s) giving rise to the claim.`,
    },
    {
      title: "10. Privacy and Data Security",
      body: `All transactions and customer information are protected in accordance with our Privacy Policy, available on our website. Payment information is processed securely through trusted third-party gateways; Animas Reflections does not store full credit card details.`,
    },
    {
      title: "11. Governing Law and Venue",
      body: `These Terms are governed by and construed in accordance with the laws of the State of Colorado, without regard to conflict of law principles. Any dispute shall be resolved in the appropriate state or federal courts located in La Plata County, Colorado.`,
    },
    {
      title: "12. Force Majeure",
      body: `Animas Reflections shall not be liable for failure to perform due to events beyond its reasonable control, including but not limited to natural disasters, labor disputes, transportation delays, or acts of government.`,
    },
    {
      title: "13. Entire Agreement",
      body: `These Terms, together with the order confirmation and any policies referenced on our website, constitute the entire agreement between Animas Reflections and the Customer regarding the sale and purchase of goods.`,
    },
  ],
} as const;

export const PAYMENT_METHODS = [
  "CashApp",
  "Apple Pay",
  "Google Pay",
  "Visa",
  "Mastercard",
  "American Express",
  "Discover",
  "JCB",
] as const;

export const RETURN_POLICY =
  "All sales are final. If you have any trouble with your order, please contact us and we will make it right." as const;
