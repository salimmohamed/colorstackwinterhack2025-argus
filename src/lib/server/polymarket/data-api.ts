/**
 * Polymarket Data API Client
 * Fetches activity and trade data from https://data-api.polymarket.com
 */

const DATA_API_BASE = "https://data-api.polymarket.com";

export interface ActivityRecord {
  proxyWallet: string;
  timestamp: number;
  conditionId: string;
  type: "TRADE" | "SPLIT" | "MERGE" | "REDEEM" | "REWARD" | "CONVERSION";
  size: number;
  usdcSize: number;
  transactionHash: string;
  price: number;
  asset: string;
  side: "BUY" | "SELL";
  outcomeIndex: number;
  title: string;
  slug: string;
  outcome: string;
  name: string;
  pseudonym: string;
  bio: string;
  profileImage: string;
  profileImageOptimized: string;
}

export interface GetActivityParams {
  user?: string;
  market?: string;
  eventId?: string;
  type?: "TRADE" | "SPLIT" | "MERGE" | "REDEEM" | "REWARD" | "CONVERSION";
  side?: "BUY" | "SELL";
  start?: number;
  end?: number;
  sortBy?: "TIMESTAMP" | "TOKENS" | "CASH";
  sortDirection?: "ASC" | "DESC";
  limit?: number;
  offset?: number;
}

export interface TradeRecord {
  id: string;
  market: string;
  asset_id: string;
  side: "BUY" | "SELL";
  size: string;
  price: string;
  status: "MATCHED" | "MINED" | "CONFIRMED";
  match_time: string;
  outcome: string;
  transaction_hash: string;
  maker_address: string;
  fee_rate_bps: string;
}

export interface Position {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  totalBought: number;
  realizedPnl: number;
  curPrice: number;
  title: string;
  slug: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  endDate: string;
}

export interface Holder {
  proxyWallet: string;
  bio?: string;
  asset: string;
  pseudonym?: string;
  amount: number;
  displayUsernamePublic: boolean;
  outcomeIndex: number;
  name?: string;
  profileImage?: string;
}

export interface HoldersResponse {
  token: string;
  holders: Holder[];
}

export class DataApiClient {
  private baseUrl: string;

  constructor(baseUrl = DATA_API_BASE) {
    this.baseUrl = baseUrl;
  }

  async getActivity(params: GetActivityParams = {}): Promise<ActivityRecord[]> {
    const searchParams = new URLSearchParams();

    if (params.user) searchParams.set("user", params.user);
    if (params.market) searchParams.set("market", params.market);
    if (params.eventId) searchParams.set("eventId", params.eventId);
    if (params.type) searchParams.set("type", params.type);
    if (params.side) searchParams.set("side", params.side);
    if (params.start) searchParams.set("start", String(params.start));
    if (params.end) searchParams.set("end", String(params.end));
    if (params.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params.sortDirection)
      searchParams.set("sortDirection", params.sortDirection);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));

    const url = `${this.baseUrl}/activity?${searchParams}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          `[DataAPI] Activity error: ${response.status} for ${url}`,
        );
        return [];
      }

      return response.json();
    } catch (error) {
      console.error(`[DataAPI] Activity fetch error:`, error);
      return [];
    }
  }

  /**
   * Get all activity for a specific account
   */
  async getAccountActivity(
    address: string,
    limit = 500,
  ): Promise<ActivityRecord[]> {
    return this.getActivity({
      user: address.toLowerCase(),
      limit,
      sortBy: "TIMESTAMP",
      sortDirection: "DESC",
    });
  }

  /**
   * Get recent activity for a specific market
   * Uses the /trades endpoint which supports market queries
   */
  async getMarketActivity(
    marketId: string,
    hoursBack = 72,
    minTradeSize?: number,
  ): Promise<ActivityRecord[]> {
    // Use the /trades endpoint instead of /activity (which requires user param)
    const trades = await this.getMarketTradesAsActivity(marketId, {
      limit: 500,
    });

    // Filter by time window
    const cutoffTime = Date.now() / 1000 - hoursBack * 3600;
    let filteredTrades = trades.filter((a) => a.timestamp >= cutoffTime);

    // Filter by minimum trade size if specified
    if (minTradeSize) {
      filteredTrades = filteredTrades.filter(
        (a) => (a.usdcSize ?? a.size * a.price) >= minTradeSize,
      );
    }

    return filteredTrades;
  }

  /**
   * Get market trades as ActivityRecord format
   */
  async getMarketTradesAsActivity(
    conditionId: string,
    options: { limit?: number } = {},
  ): Promise<ActivityRecord[]> {
    const params = new URLSearchParams();
    params.set("market", conditionId);
    params.set("limit", String(options.limit || 500));

    try {
      const response = await fetch(`${this.baseUrl}/trades?${params}`);
      if (!response.ok) {
        console.error(`[DataAPI] Failed to fetch trades: ${response.status}`);
        return [];
      }
      return response.json();
    } catch (error) {
      console.error(`[DataAPI] Trades fetch error:`, error);
      return [];
    }
  }

  /**
   * Get large trades for a market (potential insider activity)
   */
  async getLargeTrades(
    marketId: string,
    minSizeUsd = 5000,
    hoursBack = 168,
  ): Promise<ActivityRecord[]> {
    const activity = await this.getMarketActivity(marketId, hoursBack);
    return activity.filter((a) => a.usdcSize >= minSizeUsd);
  }

  /**
   * Calculate account statistics from activity
   */
  calculateAccountStats(activity: ActivityRecord[]): {
    totalTrades: number;
    totalVolume: number;
    averageTradeSize: number;
    firstTradeTimestamp: number | null;
    lastTradeTimestamp: number | null;
    uniqueMarkets: string[];
  } {
    const trades = activity.filter((a) => a.type === "TRADE");

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        totalVolume: 0,
        averageTradeSize: 0,
        firstTradeTimestamp: null,
        lastTradeTimestamp: null,
        uniqueMarkets: [],
      };
    }

    const totalVolume = trades.reduce((sum, t) => sum + t.usdcSize, 0);
    const timestamps = trades.map((t) => t.timestamp);
    const uniqueMarkets = [...new Set(trades.map((t) => t.conditionId))];

    return {
      totalTrades: trades.length,
      totalVolume,
      averageTradeSize: totalVolume / trades.length,
      firstTradeTimestamp: Math.min(...timestamps),
      lastTradeTimestamp: Math.max(...timestamps),
      uniqueMarkets,
    };
  }

  /**
   * Get user positions
   */
  async getUserPositions(address: string): Promise<Position[]> {
    const url = `${this.baseUrl}/positions?user=${address.toLowerCase()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Data API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get market holders (position distribution)
   */
  async getMarketHolders(conditionId: string): Promise<HoldersResponse[]> {
    const params = new URLSearchParams();
    params.set("market", conditionId);
    params.set("limit", "20");
    params.set("minBalance", "100");

    const response = await fetch(`${this.baseUrl}/holders?${params}`);
    if (!response.ok) {
      console.error(`[DataAPI] Failed to fetch holders: ${response.status}`);
      return [];
    }
    return response.json();
  }

  /**
   * Get first trade timestamp for an account
   */
  async getAccountFirstTrade(address: string): Promise<number | null> {
    const activity = await this.getActivity({
      user: address.toLowerCase(),
      type: "TRADE",
      sortBy: "TIMESTAMP",
      sortDirection: "ASC",
      limit: 1,
    });

    if (activity.length === 0) return null;
    return activity[0].timestamp;
  }

  /**
   * Get market trades (for market-level queries)
   */
  async getMarketTrades(
    conditionId: string,
    options: { limit?: number; hoursBack?: number } = {},
  ): Promise<TradeRecord[]> {
    const params = new URLSearchParams();
    params.set("market", conditionId);
    if (options.limit) params.set("limit", String(options.limit));

    const url = `https://clob.polymarket.com/trades?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`CLOB API error: ${response.status}`);
    }

    return response.json();
  }
}

// Singleton instance
export const dataApiClient = new DataApiClient();
