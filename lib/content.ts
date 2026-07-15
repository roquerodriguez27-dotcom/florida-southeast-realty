import type { GuideArticle, BlogPost } from "./types";

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`;

// Note: no client testimonials are included in this project. Real, verified
// client reviews should be added here once collected (with permission),
// rather than shown as placeholder or invented quotes.

export const GUIDES: GuideArticle[] = [
  {
    slug: "buying-waterfront-property-southeast-florida",
    title: "What Actually Matters When Buying Waterfront in Southeast Florida",
    dek: "Fixed bridges, seawall condition, and flood zone letters — the details that decide whether a waterfront deal is a bargain or a liability.",
    category: "Buying",
    readMinutes: 9,
    image: img("photo-1600596542815-ffad4c1539a9"),
    publishedAt: "2026-05-12",
    body: [
      "Waterfront in Southeast Florida isn't one category of home — it's several, and the difference between them changes what a property is worth. A canal lot with a fixed bridge between it and the Intracoastal caps the size of boat you'll ever dock there, permanently. That single fact can separate two otherwise identical seawalls by a wide margin in resale value.",
      "Ask for the seawall's age and last inspection before you fall for the view. Broward and Palm Beach counties see seawalls fail on a fairly predictable schedule, and replacement runs into six figures on a wide lot. A seller with recent engineering documentation is telling you something worth paying for.",
      "Flood zone letters matter more than the listing photos suggest. A property in an X zone versus an AE zone can mean a four-figure swing in annual insurance, and that gap has only widened. Pull the flood elevation certificate before you get attached to a floor plan, not after.",
      "Dock permitting is its own small research project. Older docks were often permitted under rules that no longer apply, which means a full rebuild may require a new, more restrictive permit. If the dock is part of why you're buying, get a straight answer on what you're allowed to build before closing, not after.",
    ],
  },
  {
    slug: "selling-your-home-fort-lauderdale-timing",
    title: "When to List in Fort Lauderdale: Reading the Season Right",
    dek: "Southeast Florida's market doesn't move on the calendar everyone assumes. Here's what the days-on-market data actually shows.",
    category: "Selling",
    readMinutes: 7,
    image: img("photo-1600047509807-ba8f99d2cdde"),
    publishedAt: "2026-04-03",
    body: [
      "The conventional wisdom says list in spring. In Southeast Florida, the stronger signal is the snowbird calendar: serious buyers with cash and no financing contingency are often in town from January through March, which means homes that list in late fall have time to season before that wave arrives.",
      "Homes priced right in the first two weeks consistently outperform homes that start high and chase the market down. Southeast Florida buyers who are house-hunting in person, rather than remotely, notice a stale listing fast — the whisper network in condo buildings and gated communities is real.",
      "Staging trades differently here than up north. Buyers relocating from colder markets respond to move-in-ready more than to blank neutral staging — they're often buying a lifestyle change, not just a floor plan, and want to see it lived in.",
    ],
  },
  {
    slug: "relocating-to-southeast-florida-neighborhood-guide",
    title: "Relocating to Southeast Florida: How to Actually Choose a Neighborhood",
    dek: "A framework for narrowing dozens of coastal towns down to the handful that fit how you actually live.",
    category: "Relocation",
    readMinutes: 11,
    image: img("photo-1570737543243-cd82cbd1e8c9"),
    publishedAt: "2026-03-19",
    body: [
      "Most relocation searches start with a map and end in overwhelm — there are more distinct, walkable coastal towns between Boca Raton and Fort Lauderdale than most newcomers expect, and they don't feel alike up close even when they look similar from a listing photo.",
      "Start with commute reality, not commute distance. Five miles on Federal Highway at 8am is a different commute than five miles on A1A. If you'll drive daily, spend an actual weekday morning in the car before you commit to a zip code.",
      "Decide early whether you want density or distance from neighbors, because Southeast Florida offers both within a few miles of each other — a boutique high-rise on Las Olas and a wide canal lot in Coral Ridge solve very different problems.",
      "If schools matter, tour in session, not on a weekend open house circuit. Boundary lines shift, and the only way to know what your kids' daily experience will be is to see the campus while it's running.",
    ],
  },
];

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-we-read-the-broward-palm-beach-market",
    title: "How We Read the Broward & Palm Beach Market Each Quarter",
    dek: "The indicators our agents actually track before advising a client on price — and why we don't lean on national headlines to set local strategy.",
    category: "Market Report",
    image: img("photo-1560518883-ce09059eeffa"),
    publishedAt: "2026-07-01",
    author: "Florida Southeast Realty",
    body: [
      "Placeholder for a live market report. Rather than publish specific figures we can't currently verify, this space is reserved for a quarterly update built from your MLS's own statistics package once the brokerage is fully set up — inventory counts, median days-on-market, and absorption rate by community.",
      "In practice, we weight a handful of local indicators over national coverage: how waterfront inventory with no fixed bridges to the Intracoastal is moving relative to fixed-bridge canals, and whether condo buildings with completed structural reserve studies are commanding a premium over buildings still working through assessments.",
      "When this section goes live, each quarter's post will cite the specific MLS report or public data source it draws from, so readers can check the numbers themselves rather than take our word for it.",
    ],
  },
  {
    slug: "hurricane-season-home-prep-checklist",
    title: "The Homeowner's Hurricane Season Checklist We Actually Recommend",
    dek: "Not the generic list — the specific prep steps that matter most for Southeast Florida's building stock and insurance climate.",
    category: "Homeownership",
    image: img("photo-1500648767791-00dcc994a43e"),
    publishedAt: "2026-06-14",
    author: "Devon Ashford",
    body: [
      "Photograph every room and the exterior of your home before the season starts, timestamped and stored somewhere other than your phone. It sounds excessive until you need it for a claim, at which point it's the single most useful thing you did all year.",
      "Know your roof's actual age and permit history, not the age you assume. Many insurers in this market now require documentation before renewal, and a roof nearing the end of its expected life can affect both your premium and your ability to sell without a credit at closing.",
      "If you have a dock or seawall, walk it before storm season and after every named storm that passes near you. Small cracks are cheap to address early and expensive to ignore.",
    ],
  },
  {
    slug: "illustrative-example-coral-ridge-renovation",
    title: "Illustrative Example: Restoring a Coral Ridge Mid-Century Instead of a Teardown",
    dek: "A representative, composite scenario — not a specific client — showing how a restoration decision can play out in this neighborhood.",
    category: "Client Stories",
    image: img("photo-1568605114967-8130f3a36994"),
    publishedAt: "2026-05-28",
    author: "Florida Southeast Realty",
    body: [
      "This is an illustrative, composite scenario built from patterns we see in Coral Ridge, not an account of a specific named client. Real client stories will replace it here once we have permission to share them.",
      "The scenario: a buyer purchases a Coral Ridge canal lot where most nearby interest has come from buyers planning to demolish and rebuild larger. Instead, they restore original terrazzo and vaulted ceilings while modernizing the kitchen and systems.",
      "The illustrative outcome is that thoughtful restoration can hold its own against new construction in a neighborhood where the architecture itself is part of the value — though actual results vary by property and should be evaluated with a current comparative market analysis, not this example.",
    ],
  },
];

export async function getGuides(): Promise<GuideArticle[]> {
  return GUIDES;
}

export async function getGuideBySlug(slug: string): Promise<GuideArticle | undefined> {
  return GUIDES.find((g) => g.slug === slug);
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  return BLOG_POSTS;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  return BLOG_POSTS.find((b) => b.slug === slug);
}
