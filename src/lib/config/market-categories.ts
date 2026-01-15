/**
 * Market Category Configuration for Insider Trading Detection
 *
 * Defines categories of Polymarket events to monitor.
 * Uses Polymarket Gamma API tag IDs for precise filtering.
 */

export interface MarketCategory {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  maxMarkets: number;
  tagIds: string[];
  keywords: string[]; // Fallback validation keywords
  insiderRelevance: "high" | "medium" | "low";
}

/**
 * Market categories optimized for insider trading detection.
 *
 * Selection criteria:
 * - Events with predictable outcomes (not random/volatile)
 * - Categories where insider knowledge is valuable
 * - Avoid: crypto (too volatile), sports (less insider-driven)
 */
export const MARKET_CATEGORIES: MarketCategory[] = [
  {
    id: "us-politics",
    name: "US Politics",
    description: "US elections, nominations, and political events",
    enabled: true,
    maxMarkets: 35,
    tagIds: ["24", "1101", "100199", "766", "126", "298", "325"],
    // Tag IDs: USA Election, US Election, Senate, Congress, Trump, VP Nominee, Democratic Presidential Nomination
    keywords: [
      "president",
      "election",
      "nominee",
      "trump",
      "democrat",
      "republican",
      "congress",
      "senate",
      "governor",
      "vote",
      "poll",
      "biden",
      "harris",
      "vance",
      "fed",
      "supreme court",
      "tariff",
      "deport",
    ],
    insiderRelevance: "high",
  },
];

/**
 * Default total market limit across all categories
 */
export const DEFAULT_TOTAL_MARKET_LIMIT = 35;

/**
 * Get all enabled categories sorted by priority (based on array order)
 */
export function getEnabledCategories(): MarketCategory[] {
  return MARKET_CATEGORIES.filter((c) => c.enabled);
}

/**
 * Get a category by its ID
 */
export function getCategoryById(id: string): MarketCategory | undefined {
  return MARKET_CATEGORIES.find((c) => c.id === id);
}

/**
 * Get total max markets across all enabled categories
 */
export function getTotalMaxMarkets(): number {
  return getEnabledCategories().reduce((sum, c) => sum + c.maxMarkets, 0);
}

/**
 * Check if text matches any keyword in a category
 */
export function matchesCategoryKeywords(
  text: string,
  category: MarketCategory
): boolean {
  const lower = text.toLowerCase();
  return category.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}
