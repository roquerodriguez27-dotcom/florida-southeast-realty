import type { GuideArticle, BlogPost } from "./types";

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`;

export const GUIDES: GuideArticle[] = [
  {
    slug: "buying-waterfront-property-southeast-florida",
    title: "Buying Waterfront Property in South Florida: What to Research First",
    dek: "A practical starting point for evaluating docks, seawalls, bridge access, flood information, insurance, and permits before you commit.",
    category: "Buying",
    readMinutes: 8,
    image: img("photo-1600596542815-ffad4c1539a9"),
    publishedAt: "2026-08-08",
    body: [
      "Waterfront property deserves a different due-diligence checklist from a typical inland home. Start by identifying exactly what body of water the property sits on and whether fixed bridges, bridge clearances, canal depth, tidal conditions, or other access constraints matter for the boat you own or plan to own. Do not rely on a listing description alone for navigability or dock capability.",
      "Review the seawall, dock, lift, and related improvements as separate components of the property. Ask for available permits, repair history, engineering information, and contractor documentation, then use qualified professionals when condition or remaining useful life is important to your decision. A beautiful water view does not answer structural or permitting questions.",
      "Flood-zone information and insurance should be researched early, not after the inspection period is almost over. Use current FEMA mapping and speak with insurance professionals about the specific address, structure, elevation information, roof, openings, prior claims information when available, and the coverage you would actually need.",
      "Finally, check local permitting and environmental requirements before assuming you can expand a dock, add a lift, change a seawall, dredge, or alter waterfront structures. What exists today does not automatically tell you what can be rebuilt or modified in the future. The goal is to understand the property you are buying, not just the photograph that brought you to it.",
    ],
  },
  {
    slug: "prepare-south-florida-home-for-sale",
    title: "How to Prepare a South Florida Home for Sale",
    dek: "Pricing, permits, insurance questions, condition, presentation, and the documents that can make a listing easier for buyers to evaluate.",
    category: "Selling",
    readMinutes: 7,
    image: img("photo-1600047509807-ba8f99d2cdde"),
    publishedAt: "2026-08-02",
    body: [
      "A strong listing starts before the photography. Gather the documents buyers are likely to ask about: permits for major work, roof information, association documents if applicable, survey or elevation information you already have, warranties, and records for meaningful upgrades. You do not need to create documents that do not exist, but knowing what you have prevents avoidable delays later.",
      "Pricing should be based on current competing inventory, recent relevant sales, property condition, location, and the features buyers can actually compare. An asking price is a marketing decision as much as a mathematical one. The goal is not to choose the highest number a seller would enjoy seeing; it is to choose a strategy that supports the seller's timing and negotiating position.",
      "Presentation matters because buyers make decisions both online and in person. Repair obvious defects, reduce visual clutter, improve lighting, address landscaping, and make sure major spaces photograph clearly. For occupied homes, the best preparation plan is usually the one the seller can realistically maintain through showings.",
      "South Florida buyers may also ask about insurance-related features, flood information, impact protection, roof age, association reserves, and assessments depending on the property. A seller who can answer factual questions quickly helps buyers evaluate the home with less uncertainty. Your broker can help identify which questions are likely to arise for your property type.",
    ],
  },
  {
    slug: "relocating-to-south-florida-neighborhood-guide",
    title: "Relocating to South Florida: How to Compare Communities",
    dek: "A neutral framework for comparing commute, housing type, flood and insurance considerations, schools, associations, and lifestyle without relying on someone else's idea of the 'best' neighborhood.",
    category: "Relocation",
    readMinutes: 10,
    image: img("photo-1570737543243-cd82cbd1e8c9"),
    publishedAt: "2026-07-24",
    body: [
      "Start with the parts of daily life that are difficult to change after closing. Map the places you expect to visit most often, test commute times at the hours you would actually travel, and decide whether you want a walkable downtown, beach access, boating, a gated community, an equestrian area, a larger lot, or a lower-maintenance condo. Those preferences narrow South Florida quickly.",
      "Then compare the financial structure of the homes, not just their list prices. Property taxes, insurance, flood exposure, HOA or condominium fees, club requirements, assessments, maintenance responsibility, and future renovation needs can make two similarly priced properties feel very different once you own them.",
      "If schools matter to your household, use current official district information and verify the assignment for the specific address. Boundaries and programs can change. Review objective school information yourself rather than asking a real estate professional to tell you whether a school or neighborhood is 'good' or 'bad.'",
      "Finally, spend time in the areas you are considering at more than one time of day. Visit the grocery stores, parks, beaches, downtown areas, marinas, or other places that matter to you. A useful relocation search is not about finding a universally 'best' community; it is about finding the location and property structure that fit your priorities.",
    ],
  },
];

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-research-south-florida-property-before-buying",
    title: "How to Research a South Florida Property Before You Buy",
    dek: "The public records and third-party resources worth checking before inspection deadlines and closing dates start moving fast.",
    category: "Buyer Research",
    image: img("photo-1560518883-ce09059eeffa"),
    publishedAt: "2026-08-12",
    author: "Roque Rodriguez",
    body: [
      "A listing tells you what is being marketed. Due diligence tells you what you are buying. Before you rely on a property description, compare the address with the county property appraiser, current flood mapping, available permit records, the applicable association documents, and any other public or transaction documents relevant to the property.",
      "The right checklist changes by property type. A waterfront home may call for dock and seawall research. A condo may require close review of association finances, reserves, assessments, inspections, insurance, restrictions, and building documents. An older single-family home may make permit history, roof information, electrical systems, plumbing, additions, and prior renovations especially important.",
      "Use specialists for specialist questions. Inspectors, engineers, insurance professionals, attorneys, accountants, surveyors, contractors, lenders, and association managers each answer different parts of the puzzle. A broker's job includes helping you recognize the questions and manage the transaction, not pretending one person can replace every expert.",
    ],
  },
  {
    slug: "south-florida-condo-due-diligence",
    title: "South Florida Condo Due Diligence: What Buyers Should Review",
    dek: "A condo purchase is partly a real estate decision and partly a decision about the building and association you are joining.",
    category: "Condos",
    image: img("photo-1486406146926-c627a92ad1ab"),
    publishedAt: "2026-08-05",
    author: "Florida Southeast Realty",
    body: [
      "When you buy a condominium, your unit is only part of the decision. Review the association documents and the information available about budgets, reserves, current or proposed assessments, insurance, maintenance responsibilities, rental rules, pet rules, parking, application requirements, and major building projects. The exact documents and review rights depend on the transaction, so use the contract and qualified legal advice when timing matters.",
      "Ask how the monthly or quarterly fees fit into the building's overall financial picture rather than judging a fee in isolation. A lower fee does not automatically mean a better-run association, and a higher fee does not tell you whether future capital needs are fully funded. The question is what the fee covers, what the building expects to spend, and what obligations could affect owners.",
      "For coastal and waterfront buildings, also consider flood exposure, wind insurance, building insurance structure, parking elevation, water intrusion history when available, and the condition of common elements. Buyers should make decisions from current documents and professional advice, not assumptions based on the age or appearance of the building.",
    ],
  },
  {
    slug: "seller-document-checklist-before-listing",
    title: "What South Florida Sellers Should Gather Before Listing",
    dek: "A simple document checklist that can make buyer questions, inspections, and contract-to-close work more smoothly.",
    category: "Selling",
    image: img("photo-1568605114967-8130f3a36994"),
    publishedAt: "2026-07-29",
    author: "Roque Rodriguez",
    body: [
      "Before a home goes on the market, collect the records you already have for major improvements and systems. Useful examples can include roof documents, permits, impact-window or shutter information, HVAC records, surveys, elevation certificates, warranties, receipts for major renovations, and association documents. What matters depends on the property, and not every seller will have every item.",
      "If the home is part of an HOA, condominium, club, or other association, locate the current contact information and the documents available to you. Buyers and their professionals may ask about fees, applications, rules, budgets, assessments, reserves, leasing, pets, parking, or approval timelines. Getting organized early helps avoid searching for documents under a contract deadline.",
      "Do not guess when a buyer asks for a factual answer you do not know. It is better to identify the right source and verify the information. Clear documentation supports a cleaner transaction and gives buyers more confidence in the information they are using to make a decision.",
    ],
  },
];

export async function getGuides(): Promise<GuideArticle[]> {
  return GUIDES;
}

export async function getGuideBySlug(slug: string): Promise<GuideArticle | undefined> {
  return GUIDES.find((guide) => guide.slug === slug);
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  return BLOG_POSTS;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
