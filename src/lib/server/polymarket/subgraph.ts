/**
 * Polymarket Subgraph Client
 * Queries blockchain data via The Graph
 */

// Public Polymarket subgraph endpoints
const SUBGRAPH_URLS = {
  activity:
    "https://api.thegraph.com/subgraphs/name/polymarket/activity-polygon",
  markets:
    "https://api.thegraph.com/subgraphs/name/polymarket/matic-markets-v2",
};

export interface SubgraphTrade {
  id: string;
  timestamp: string;
  user: string;
  type: string;
  collateral: string;
  amount: string;
  feeAmount: string;
  tokenId: string;
  conditionId: string;
}

export interface SubgraphUser {
  id: string;
  tradeCount: string;
  totalVolume: string;
  firstTradeTimestamp: string;
  lastTradeTimestamp: string;
}

export interface SubgraphPosition {
  id: string;
  owner: string;
  condition: string;
  outcomeIndex: number;
  balance: string;
  timestamp: string;
}

export class SubgraphClient {
  async query<T>(
    endpoint: string,
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(
        `Subgraph error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }

    return result.data;
  }

  /**
   * Get account's first trade timestamp (to determine account age)
   */
  async getAccountFirstTrade(
    address: string,
  ): Promise<{ timestamp: number } | null> {
    const query = `
      query GetFirstTrade($account: String!) {
        trades(
          where: { user: $account }
          orderBy: timestamp
          orderDirection: asc
          first: 1
        ) {
          timestamp
        }
      }
    `;

    try {
      const result = await this.query<{ trades: Array<{ timestamp: string }> }>(
        SUBGRAPH_URLS.activity,
        query,
        { account: address.toLowerCase() },
      );

      if (!result.trades || result.trades.length === 0) {
        return null;
      }

      return {
        timestamp: Number.parseInt(result.trades[0].timestamp, 10) * 1000,
      };
    } catch {
      // Subgraph might not be available, return null
      return null;
    }
  }

  /**
   * Get account trade count
   */
  async getAccountTradeCount(address: string): Promise<number> {
    const query = `
      query GetTradeCount($id: ID!) {
        user(id: $id) {
          tradeCount
        }
      }
    `;

    try {
      const result = await this.query<{ user: SubgraphUser | null }>(
        SUBGRAPH_URLS.activity,
        query,
        { id: address.toLowerCase() },
      );

      return result.user ? Number.parseInt(result.user.tradeCount, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get user's positions for a specific market
   */
  async getUserPositions(
    address: string,
    conditionId?: string,
  ): Promise<SubgraphPosition[]> {
    const whereClause = conditionId
      ? `{ owner: $address, condition: $conditionId }`
      : `{ owner: $address }`;

    const query = `
      query GetPositions($address: String!, $conditionId: String) {
        positions(
          where: ${whereClause}
          first: 100
        ) {
          id
          owner
          condition
          outcomeIndex
          balance
          timestamp
        }
      }
    `;

    try {
      const result = await this.query<{ positions: SubgraphPosition[] }>(
        SUBGRAPH_URLS.activity,
        query,
        {
          address: address.toLowerCase(),
          conditionId: conditionId?.toLowerCase(),
        },
      );

      return result.positions || [];
    } catch {
      return [];
    }
  }

  /**
   * Get recent large trades on a market
   */
  async getRecentLargeTrades(
    conditionId: string,
    minAmount: string,
    limit = 50,
  ): Promise<SubgraphTrade[]> {
    const query = `
      query GetLargeTrades($conditionId: String!, $minAmount: BigInt!, $limit: Int!) {
        trades(
          where: { conditionId: $conditionId, amount_gte: $minAmount }
          orderBy: timestamp
          orderDirection: desc
          first: $limit
        ) {
          id
          timestamp
          user
          type
          collateral
          amount
          feeAmount
          tokenId
          conditionId
        }
      }
    `;

    try {
      const result = await this.query<{ trades: SubgraphTrade[] }>(
        SUBGRAPH_URLS.activity,
        query,
        {
          conditionId: conditionId.toLowerCase(),
          minAmount,
          limit,
        },
      );

      return result.trades || [];
    } catch {
      return [];
    }
  }

  /**
   * Calculate account age in days
   */
  async getAccountAgeDays(address: string): Promise<number | null> {
    const firstTrade = await this.getAccountFirstTrade(address);

    if (!firstTrade) {
      return null;
    }

    const ageMs = Date.now() - firstTrade.timestamp;
    return Math.floor(ageMs / (24 * 60 * 60 * 1000));
  }
}

// Singleton instance
export const subgraphClient = new SubgraphClient();
