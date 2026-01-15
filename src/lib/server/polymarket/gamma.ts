/**
 * Polymarket Gamma API Client
 * Fetches market data from https://gamma-api.polymarket.com
 */

import {
  type MarketCategory,
  getEnabledCategories,
  matchesCategoryKeywords,
} from "@/lib/config/market-categories";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export interface GammaMarket {
  id: string;
  question: string | null;
  conditionId: string;
  slug: string | null;
  category: string | null;
  description: string | null;
  outcomePrices: string | string[]; // Can be JSON string or array
  outcomes: string | string[]; // Can be JSON string or array
  volume: string | null;
  volumeNum: number | null;
  volume24hr: number | null;
  liquidity: string | null;
  liquidityNum: number | null;
  endDate: string | null;
  active: boolean | null;
  closed: boolean | null;
  marketMakerAddress: string;
  enableOrderBook: boolean | null;
  orderPriceMinTickSize: number | null;
  tags: Array<{ id: string; label: string }>;
}

export interface GammaMarketResponse {
  data: GammaMarket[];
  next_cursor?: string;
}

export interface GetMarketsParams {
  category?: string;
  closed?: boolean;
  active?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  tag_id?: string;
}

export class GammaClient {
  private baseUrl: string;

  constructor(baseUrl = GAMMA_API_BASE) {
    this.baseUrl = baseUrl;
  }

  async getMarkets(params: GetMarketsParams = {}): Promise<GammaMarket[]> {
    const searchParams = new URLSearchParams();

    if (params.category) searchParams.set("category", params.category);
    if (params.closed !== undefined)
      searchParams.set("closed", String(params.closed));
    if (params.active !== undefined)
      searchParams.set("active", String(params.active));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));
    if (params.order) searchParams.set("order", params.order);
    if (params.ascending !== undefined)
      searchParams.set("ascending", String(params.ascending));
    if (params.tag_id) searchParams.set("tag_id", params.tag_id);

    const url = `${this.baseUrl}/markets?${searchParams}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Gamma API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  async getMarketBySlug(slug: string): Promise<GammaMarket | null> {
    const url = `${this.baseUrl}/markets/slug/${encodeURIComponent(slug)}`;
    const response = await fetch(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Gamma API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  async getMarketById(conditionId: string): Promise<GammaMarket | null> {
    const url = `${this.baseUrl}/markets/${encodeURIComponent(conditionId)}`;
    const response = await fetch(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Gamma API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Fetch political markets (elections, politics category)
   */
  async getPoliticalMarkets(limit = 50): Promise<GammaMarket[]> {
    // Fetch markets from politics category
    const markets = await this.getMarkets({
      category: "politics",
      active: true,
      closed: false,
      limit,
      order: "volumeNum",
      ascending: false,
    });

    return markets;
  }

  /**
   * Fetch 2028 Presidential Election markets specifically
   */
  async get2028ElectionMarkets(): Promise<GammaMarket[]> {
    const allPolitical = await this.getPoliticalMarkets(100);

    // Filter for 2028 election related markets
    return allPolitical.filter(
      (market) =>
        market.question?.toLowerCase().includes("2028") ||
        market.slug?.toLowerCase().includes("2028") ||
        market.description?.toLowerCase().includes("2028 presidential"),
    );
  }
}

/**
 * Event from Polymarket (groups related markets)
 */
export interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  volume: number;
  liquidity: number;
  markets: GammaMarket[];
  active: boolean;
  closed: boolean;
  endDate: string | null;
}

export interface GetEventsParams {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Event with category assignment
 */
export interface CategorizedEvent extends GammaEvent {
  categoryId: string;
  categoryName: string;
}

// Extend the GammaClient class with event methods
declare module "./gamma" {
  interface GammaClient {
    getEvents(params?: GetEventsParams): Promise<GammaEvent[]>;
    getEventBySlug(slug: string): Promise<GammaEvent | null>;
    getTopPoliticalEvents(limit?: number): Promise<GammaEvent[]>;
    getEventsByTag(tagId: string, limit?: number): Promise<GammaEvent[]>;
    getEventsForCategory(
      category: MarketCategory
    ): Promise<CategorizedEvent[]>;
    getTopMarkets(totalLimit?: number): Promise<CategorizedEvent[]>;
  }
}

GammaClient.prototype.getEvents = async function (
  this: GammaClient,
  params: GetEventsParams = {},
): Promise<GammaEvent[]> {
  const searchParams = new URLSearchParams();

  if (params.active !== undefined)
    searchParams.set("active", String(params.active));
  if (params.closed !== undefined)
    searchParams.set("closed", String(params.closed));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  const url = `${(this as any).baseUrl}/events?${searchParams}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Gamma API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
};

GammaClient.prototype.getEventBySlug = async function (
  this: GammaClient,
  slug: string,
): Promise<GammaEvent | null> {
  const url = `${(this as any).baseUrl}/events/slug/${encodeURIComponent(slug)}`;
  const response = await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Gamma API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
};

/**
 * Get top political events by volume
 */
GammaClient.prototype.getTopPoliticalEvents = async function (
  this: GammaClient,
  limit = 10,
): Promise<GammaEvent[]> {
  const events = await this.getEvents({
    active: true,
    closed: false,
    limit: 100,
  });

  // Filter for political events and sort by volume
  const politicalKeywords = [
    "president",
    "election",
    "nominee",
    "trump",
    "democrat",
    "republican",
    "fed",
    "congress",
    "senate",
    "governor",
    "vote",
    "poll",
  ];

  const politicalEvents = events.filter((event: GammaEvent) => {
    const title = event.title.toLowerCase();
    return politicalKeywords.some((kw) => title.includes(kw));
  });

  // Sort by volume descending
  politicalEvents.sort((a: GammaEvent, b: GammaEvent) => b.volume - a.volume);

  return politicalEvents.slice(0, limit);
};

/**
 * Get events by tag ID from Gamma API
 */
GammaClient.prototype.getEventsByTag = async function (
  this: GammaClient,
  tagId: string,
  limit = 50
): Promise<GammaEvent[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("tag_id", tagId);
  searchParams.set("active", "true");
  searchParams.set("closed", "false");
  searchParams.set("limit", String(limit));
  searchParams.set("order", "volume");
  searchParams.set("ascending", "false");

  const url = `${(this as any).baseUrl}/events?${searchParams}`;
  const response = await fetch(url);

  if (!response.ok) {
    console.warn(`Failed to fetch events for tag ${tagId}: ${response.status}`);
    return [];
  }

  return response.json();
};

/**
 * Get events for a specific market category
 * Uses tag-based filtering with keyword validation
 */
GammaClient.prototype.getEventsForCategory = async function (
  this: GammaClient,
  category: MarketCategory
): Promise<CategorizedEvent[]> {
  const allEvents: GammaEvent[] = [];
  const seenIds = new Set<string>();

  // Fetch events from each tag in the category
  for (const tagId of category.tagIds) {
    try {
      const events = await this.getEventsByTag(tagId, 30);
      for (const event of events) {
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id);
          allEvents.push(event);
        }
      }
      // Rate limit between tag fetches
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.warn(`Error fetching tag ${tagId}:`, error);
    }
  }

  // Filter by keywords if enabled (secondary validation)
  const validEvents = allEvents.filter((event) => {
    // Accept if title matches any keyword
    return matchesCategoryKeywords(event.title, category);
  });

  // If keyword filtering removed too many, use all events from tags
  const eventsToUse = validEvents.length >= 3 ? validEvents : allEvents;

  // Sort by volume and limit
  eventsToUse.sort((a, b) => b.volume - a.volume);
  const limited = eventsToUse.slice(0, category.maxMarkets);

  // Add category info
  return limited.map((event) => ({
    ...event,
    categoryId: category.id,
    categoryName: category.name,
  }));
};

/**
 * Get top markets across all enabled categories
 * Uses fixed allocation per category
 */
GammaClient.prototype.getTopMarkets = async function (
  this: GammaClient,
  totalLimit = 35
): Promise<CategorizedEvent[]> {
  const categories = getEnabledCategories();
  const allMarkets: CategorizedEvent[] = [];

  // Calculate per-category limits proportionally if totalLimit differs from sum
  const totalConfigured = categories.reduce((sum, c) => sum + c.maxMarkets, 0);
  const scaleFactor = totalLimit / totalConfigured;

  for (const category of categories) {
    try {
      const categoryLimit = Math.round(category.maxMarkets * scaleFactor);
      const events = await this.getEventsForCategory({
        ...category,
        maxMarkets: categoryLimit,
      });
      allMarkets.push(...events);
      console.log(
        `[Gamma] Fetched ${events.length} events for ${category.name}`
      );
    } catch (error) {
      console.error(`Error fetching category ${category.id}:`, error);
    }
  }

  // Final sort by volume and apply total limit
  allMarkets.sort((a, b) => b.volume - a.volume);
  return allMarkets.slice(0, totalLimit);
};

// Singleton instance
export const gammaClient = new GammaClient();
