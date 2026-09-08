import {
  SITE,
  HERO,
  ANNOUNCEMENT,
  NAVIGATION,
  OUR_STORY,
  DESIGN_YOUR_OWN,
  CONTACT,
  FAQ,
  FUNDRAISING,
  TERMS_OF_SALE,
  PRIVACY_POLICY,
  BISCUIT_HOCKEY,
  IM_OK_R_U,
} from "@/lib/content";

/**
 * Editable site copy. `config/site.content` stores overrides; the storefront merges
 * them over these defaults (sourced from content.ts) via mergeContent(). The admin
 * Copy editor edits these page-by-page.
 */

export interface SiteGlobalContent {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  location: string;
  description: string;
  announcementText: string;
  announcementActive: boolean;
  footerTagline: string;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface SiteHomeContent {
  heroHeading: string;
  heroSubheading: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  heroCta2Label: string;
  heroCta2Href: string;
  aboutHeading: string;
  aboutSubheading: string;
  aboutBody: string;
}

export interface SiteSimpleContent {
  heading: string;
  subheading: string;
  body: string;
}

export interface SiteContactContent {
  heading: string;
  subheading: string;
  phone: string;
  email: string;
  location: string;
  privacyNote: string;
}

export interface SiteContent {
  global: SiteGlobalContent;
  navigation: { primary: NavLink[]; footer: NavLink[] };
  home: SiteHomeContent;
  about: SiteSimpleContent;
  contact: SiteContactContent;
  custom: { heading: string; body: string };
  faq: { heading: string; subheading: string; items: { q: string; a: string }[] };
  fundraising: { heading: string; subheading: string; intro: string; howItWorks: { title: string; body: string }[]; whoFor: string[]; products: string[]; whyUs: string[] };
  terms: { heading: string; subheading: string; sections: { title: string; body: string }[] };
  privacy: { heading: string; subheading: string; sections: { title: string; body: string }[] };
  biscuitHockey: SiteSimpleContent;
  imOkRU: SiteSimpleContent;
}

export const DEFAULT_CONTENT: SiteContent = {
  global: {
    name: SITE.name,
    tagline: SITE.tagline,
    phone: SITE.phone,
    email: SITE.email,
    location: SITE.location,
    description: SITE.description,
    announcementText: ANNOUNCEMENT.text,
    announcementActive: ANNOUNCEMENT.active,
    footerTagline: "Family owned and operated design & print operation based in Durango, CO, creating unique custom designs.",
    metaTitle: `${SITE.name} — Custom Apparel, Printing & Fundraising in Durango, CO`,
    metaDescription: SITE.description,
    ogImage: "",
  },
  navigation: {
    primary: NAVIGATION.primary.map((l) => ({ label: l.label, href: l.href })),
    footer: NAVIGATION.footer.map((l) => ({ label: l.label, href: l.href })),
  },
  home: {
    heroHeading: HERO.heading,
    heroSubheading: HERO.subheading,
    heroCtaLabel: HERO.cta_primary.label,
    heroCtaHref: HERO.cta_primary.href,
    heroCta2Label: HERO.cta_secondary.label,
    heroCta2Href: HERO.cta_secondary.href,
    aboutHeading: OUR_STORY.heading,
    aboutSubheading: OUR_STORY.subheading,
    aboutBody: OUR_STORY.body,
  },
  about: { heading: OUR_STORY.heading, subheading: OUR_STORY.subheading, body: OUR_STORY.body },
  contact: {
    heading: CONTACT.heading,
    subheading: CONTACT.subheading,
    phone: CONTACT.phone,
    email: CONTACT.email,
    location: CONTACT.location,
    privacyNote: CONTACT.privacy_note,
  },
  custom: { heading: DESIGN_YOUR_OWN.heading, body: DESIGN_YOUR_OWN.body },
  faq: { heading: FAQ.heading, subheading: FAQ.subheading, items: FAQ.items.map((it) => ({ q: it.q, a: it.a })) },
  fundraising: { heading: FUNDRAISING.heading, subheading: FUNDRAISING.subheading, intro: FUNDRAISING.intro, howItWorks: FUNDRAISING.howItWorks.map((s) => ({ title: s.title, body: s.body })), whoFor: [...FUNDRAISING.whoFor], products: [...FUNDRAISING.products], whyUs: [...FUNDRAISING.whyUs] },
  terms: {
    heading: TERMS_OF_SALE.heading,
    subheading: TERMS_OF_SALE.subheading,
    sections: TERMS_OF_SALE.sections.map((s) => ({ title: s.title, body: s.body })),
  },
  privacy: {
    heading: PRIVACY_POLICY.heading,
    subheading: PRIVACY_POLICY.subheading,
    sections: PRIVACY_POLICY.sections.map((s) => ({ title: s.title, body: s.body })),
  },
  biscuitHockey: { heading: BISCUIT_HOCKEY.heading, subheading: BISCUIT_HOCKEY.subheading, body: BISCUIT_HOCKEY.body },
  imOkRU: { heading: IM_OK_R_U.heading, subheading: IM_OK_R_U.subheading, body: IM_OK_R_U.body },
};

type D = Record<string, unknown>;

const isObj = (v: unknown): v is D => !!v && typeof v === "object" && !Array.isArray(v);

type AnyRecord = Record<string, unknown>;

/** Deep-merge `input` over `base` (arrays replaced wholesale). Returns a complete object. */
function deepMerge(base: AnyRecord, input: AnyRecord | undefined): AnyRecord {
  const out: AnyRecord = { ...base };
  if (!isObj(input)) return out;
  for (const k of Object.keys(input)) {
    const bv = base[k];
    const iv = input[k];
    if (isObj(bv) && isObj(iv)) out[k] = deepMerge(bv, iv);
    else if (iv !== undefined) out[k] = iv;
  }
  return out;
}

/** Merge `config/site.content` overrides over the defaults → full SiteContent. */
export function mergeContent(input?: Partial<SiteContent> | null): SiteContent {
  return deepMerge(DEFAULT_CONTENT as unknown as AnyRecord, (input ?? {}) as unknown as AnyRecord) as unknown as SiteContent;
}

// ─── Editor metadata (page → section diagram + fields) ─────────────

export interface CopyField {
  key: string;
  label: string;
  type: "text" | "textarea" | "toggle" | "list" | "stringList";
  region: string; // diagram region this edits
  /** For "list": the sub-fields of each item (e.g. { q, a }). */
  itemFields?: { key: string; label: string; type: "text" | "textarea" }[];
  /** Singular item name shown on add/remove (e.g. "FAQ question"). */
  itemLabel?: string;
  maxItems?: number;
}

export interface CopyPage {
  id: string;
  label: string;
  route: string;
  regions: string[]; // wireframe blocks in order
  fields: CopyField[];
}

export const COPY_PAGES: CopyPage[] = [
  {
    id: "global",
    label: "Global",
    route: "Everywhere",
    regions: ["Top bar", "Footer", "Contact", "SEO"],
    fields: [
      { key: "global.name", label: "Site name", type: "text", region: "Footer" },
      { key: "global.tagline", label: "Tagline", type: "text", region: "Footer" },
      { key: "global.phone", label: "Phone", type: "text", region: "Contact" },
      { key: "global.email", label: "Email", type: "text", region: "Contact" },
      { key: "global.location", label: "Location", type: "text", region: "Contact" },
      { key: "global.announcementText", label: "Announcement bar text", type: "text", region: "Top bar" },
      { key: "global.announcementActive", label: "Show announcement bar", type: "toggle", region: "Top bar" },
      { key: "global.footerTagline", label: "Footer tagline", type: "textarea", region: "Footer" },
      { key: "global.metaTitle", label: "SEO title", type: "text", region: "SEO" },
      { key: "global.metaDescription", label: "SEO description", type: "textarea", region: "SEO" },
      { key: "global.ogImage", label: "Social share image URL", type: "text", region: "SEO" },
    ],
  },
  {
    id: "home",
    label: "Home",
    route: "/",
    regions: ["Hero", "About"],
    fields: [
      { key: "home.heroHeading", label: "Hero heading", type: "text", region: "Hero" },
      { key: "home.heroSubheading", label: "Hero subheading", type: "textarea", region: "Hero" },
      { key: "home.heroCtaLabel", label: "Primary CTA label", type: "text", region: "Hero" },
      { key: "home.heroCtaHref", label: "Primary CTA link", type: "text", region: "Hero" },
      { key: "home.heroCta2Label", label: "Secondary CTA label", type: "text", region: "Hero" },
      { key: "home.heroCta2Href", label: "Secondary CTA link", type: "text", region: "Hero" },
      { key: "home.aboutHeading", label: "About heading", type: "text", region: "About" },
      { key: "home.aboutSubheading", label: "About subheading", type: "text", region: "About" },
      { key: "home.aboutBody", label: "About body", type: "textarea", region: "About" },
    ],
  },
  {
    id: "about",
    label: "About",
    route: "/about",
    regions: ["Header", "Body", "Contact card"],
    fields: [
      { key: "about.heading", label: "Heading", type: "text", region: "Header" },
      { key: "about.subheading", label: "Subheading", type: "text", region: "Header" },
      { key: "about.body", label: "Body", type: "textarea", region: "Body" },
    ],
  },
  {
    id: "contact",
    label: "Contact",
    route: "/contact",
    regions: ["Header", "Contact card"],
    fields: [
      { key: "contact.heading", label: "Heading", type: "text", region: "Header" },
      { key: "contact.subheading", label: "Subheading", type: "textarea", region: "Header" },
      { key: "contact.privacyNote", label: "Privacy note", type: "textarea", region: "Contact card" },
    ],
  },
  {
    id: "custom",
    label: "Design Your Own",
    route: "/custom",
    regions: ["Header", "Body", "CTA"],
    fields: [
      { key: "custom.heading", label: "Heading", type: "text", region: "Header" },
      { key: "custom.body", label: "Body", type: "textarea", region: "Body" },
    ],
  },
  {
    id: "faq",
    label: "FAQ",
    route: "/faq",
    regions: ["Header", "Questions"],
    fields: [
      { key: "faq.heading", label: "Heading", type: "text", region: "Header" },
      { key: "faq.subheading", label: "Subheading", type: "textarea", region: "Header" },
      { key: "faq.items", label: "Questions & answers", type: "list", region: "Questions", itemLabel: "question", itemFields: [{ key: "q", label: "Question", type: "text" }, { key: "a", label: "Answer", type: "textarea" }] },
    ],
  },
  {
    id: "fundraising",
    label: "Fundraising",
    route: "/fundraising",
    regions: ["Header", "Intro", "Steps", "Who for", "Products", "Why us"],
    fields: [
      { key: "fundraising.heading", label: "Heading", type: "text", region: "Header" },
      { key: "fundraising.subheading", label: "Subheading", type: "text", region: "Header" },
      { key: "fundraising.intro", label: "Intro", type: "textarea", region: "Intro" },
      { key: "fundraising.howItWorks", label: "How it works steps", type: "list", region: "Steps", itemLabel: "step", itemFields: [{ key: "title", label: "Title", type: "text" }, { key: "body", label: "Body", type: "textarea" }] },
      { key: "fundraising.whoFor", label: "Who it's for", type: "stringList", region: "Who for", itemLabel: "item" },
      { key: "fundraising.products", label: "Products that sell", type: "stringList", region: "Products", itemLabel: "item" },
      { key: "fundraising.whyUs", label: "Why fundraise with us", type: "stringList", region: "Why us", itemLabel: "item" },
    ],
  },
  {
    id: "terms",
    label: "Terms of Sale",
    route: "/terms",
    regions: ["Header", "Sections"],
    fields: [
      { key: "terms.heading", label: "Heading", type: "text", region: "Header" },
      { key: "terms.subheading", label: "Subheading", type: "text", region: "Header" },
      { key: "terms.sections", label: "Sections", type: "list", region: "Sections", itemLabel: "section", itemFields: [{ key: "title", label: "Title", type: "text" }, { key: "body", label: "Body", type: "textarea" }] },
    ],
  },
  {
    id: "privacy",
    label: "Privacy",
    route: "/privacy",
    regions: ["Header", "Sections"],
    fields: [
      { key: "privacy.heading", label: "Heading", type: "text", region: "Header" },
      { key: "privacy.subheading", label: "Subheading", type: "text", region: "Header" },
      { key: "privacy.sections", label: "Sections", type: "list", region: "Sections", itemLabel: "section", itemFields: [{ key: "title", label: "Title", type: "text" }, { key: "body", label: "Body", type: "textarea" }] },
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    route: "Header / Footer",
    regions: ["Top nav", "Footer nav"],
    fields: [
      { key: "navigation.primary", label: "Top navigation links", type: "list", region: "Top nav", itemLabel: "link", itemFields: [{ key: "label", label: "Label", type: "text" }, { key: "href", label: "URL", type: "text" }] },
      { key: "navigation.footer", label: "Footer links", type: "list", region: "Footer nav", itemLabel: "link", itemFields: [{ key: "label", label: "Label", type: "text" }, { key: "href", label: "URL", type: "text" }] },
    ],
  },
  {
    id: "biscuitHockey",
    label: "Biscuit Hockey",
    route: "/biscuit-hockey",
    regions: ["Header", "Body"],
    fields: [
      { key: "biscuitHockey.heading", label: "Heading", type: "text", region: "Header" },
      { key: "biscuitHockey.subheading", label: "Subheading", type: "text", region: "Header" },
      { key: "biscuitHockey.body", label: "Body", type: "textarea", region: "Body" },
    ],
  },
  {
    id: "imOkRU",
    label: "I'm OK R U",
    route: "/im-ok-r-u",
    regions: ["Header", "Body"],
    fields: [
      { key: "imOkRU.heading", label: "Heading", type: "text", region: "Header" },
      { key: "imOkRU.subheading", label: "Subheading", type: "text", region: "Header" },
      { key: "imOkRU.body", label: "Body", type: "textarea", region: "Body" },
    ],
  },
];

/** Read a dotted path (e.g. "about.body") from a SiteContent object. */
export function getContentPath(content: SiteContent, path: string): string | boolean {
  const parts = path.split(".");
  let cur: unknown = content;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as D)) cur = (cur as D)[p];
    else return "";
  }
  return typeof cur === "string" || typeof cur === "boolean" ? (cur as string | boolean) : "";
}

/** Write a dotted path (e.g. "about.body") into a new SiteContent object. */
export function setContentPath(content: SiteContent, path: string, value: string | boolean): SiteContent {
  const parts = path.split(".");
  const root = JSON.parse(JSON.stringify(content)) as D;
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]] as D;
  }
  cur[parts[parts.length - 1]] = value;
  return root as unknown as SiteContent;
}

/** Read an array at a dotted path (e.g. "faq.items"). Returns [] if absent. */
export function getContentArray(content: SiteContent, path: string): unknown[] {
  const parts = path.split(".");
  let cur: unknown = content;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as D)) cur = (cur as D)[p];
    else return [];
  }
  return Array.isArray(cur) ? (cur as unknown[]) : [];
}

/** Replace an array at a dotted path. */
export function setContentArray(content: SiteContent, path: string, value: unknown[]): SiteContent {
  const parts = path.split(".");
  const root = JSON.parse(JSON.stringify(content)) as D;
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]] as D;
  }
  cur[parts[parts.length - 1]] = value;
  return root as unknown as SiteContent;
}

/** Append an item to a list at a dotted path. */
export function addContentItem(content: SiteContent, path: string, template: unknown): SiteContent {
  const arr = [...getContentArray(content, path)];
  arr.push(template);
  return setContentArray(content, path, arr);
}

/** Remove an item from a list at a dotted path (by index). */
export function removeContentItem(content: SiteContent, path: string, index: number): SiteContent {
  const arr = [...getContentArray(content, path)];
  arr.splice(index, 1);
  return setContentArray(content, path, arr);
}
