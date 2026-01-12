/**
 * Agent type definitions
 */

// Tool definition for Claude
export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Tool call from Claude's response
export interface ToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// Tool result to send back
export interface ToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// Message content block
export type ContentBlock =
  | { type: "text"; text: string }
  | ToolUse
  | ToolResult;

// Message in conversation
export interface Message {
  role: "user" | "assistant";
  content: ContentBlock[] | string;
}

// Claude API response
export interface ClaudeResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Comprehensive account data for AI analysis
export interface AccountData {
  // Identity
  address: string;
  currentDisplayName: string | null;
  previousDisplayNames: string[];
  nameChangeCount: number;
  hasObfuscatedName: boolean;

  // Account Age
  firstActivityTimestamp: number | null;
  accountAgeDays: number | null;

  // Trading History
  totalTrades: number;
  totalVolumeUsd: number;
  averageTradeSize: number;
  largestTrade: {
    amount: number;
    marketSlug: string;
    timestamp: number;
  } | null;

  // Win/Loss Record
  resolvedPositions: number;
  wins: number;
  losses: number;
  winRate: number;
  profitLossUsd: number;
  realizedProfit: number;
  unrealizedProfit: number;

  // Market Focus
  marketCategories: string[];
  politicalMarketExposure: number;

  // Current positions
  positions: Array<{
    market: string;
    outcome: string;
    size: number;
    currentValue: number;
    initialValue: number;
    realizedPnl: number;
    unrealizedPnl: number;
  }>;

  // Recent Activity
  recentTrades: Array<{
    timestamp: number;
    marketSlug: string;
    outcome: string;
    side: "BUY" | "SELL";
    amount: number;
    price: number;
  }>;

  // Timing Patterns
  tradesNearEventResolution: Array<{
    marketSlug: string;
    tradeTimestamp: number;
    hoursBeforeResolution: number;
    amount: number;
  }>;
}

// Market activity data for AI analysis
export interface MarketActivityData {
  marketId: string;
  marketSlug: string;
  question: string;
  endDate: number | null;

  // Recent trades
  trades: Array<{
    traderAddress: string;
    traderName: string | null;
    timestamp: number;
    side: "BUY" | "SELL";
    outcome: string;
    amount: number;
    price: number;
  }>;

  // Summary stats
  totalVolume: number;
  uniqueTraders: number;
  largeTradeCount: number;
  averageTradeSize: number;

  // Top traders by volume
  topTraders?: Array<{
    address: string;
    volume: number;
  }>;
}

// Market holders data
export interface MarketHoldersData {
  marketId: string;
  totalHolders: number;
  totalValue: number;
  holders: Array<{
    address: string;
    amount: number;
    percentOfMarket: number;
  }>;
  top5Concentration: number;
  largestHolderPercent: number;
}

// Wallet positions data
export interface WalletPositionsData {
  address: string;
  totalPositions: number;
  totalValue: number;
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  uniqueMarkets: number;
  positions: Array<{
    market: string;
    conditionId: string;
    outcome: string;
    size: number;
    currentValue: number;
    initialValue: number;
    realizedPnl: number;
    unrealizedPnl: number;
    percentChange: number;
  }>;
  largestPosition: {
    market: string;
    value: number;
    pnl: number;
  } | null;
}

// Market comparison data
export interface MarketComparisonData {
  address: string;
  marketId: string;
  marketQuestion: string;
  // Relative metrics
  relativeBetSize: number;
  marketDominance: number;
  volumePercentile: number;
  holderRank: number | null;
  // Absolute context
  traderVolume: number;
  traderLargestTrade: number;
  marketAverageTradeSize: number;
  marketTotalVolume: number;
  totalMarketTraders: number;
  // Interpretation helpers
  isWhale: boolean;
  isDominant: boolean;
  isTopTrader: boolean;
}

// Alert evidence for flagging
export interface AlertEvidence {
  accountAgeDays?: number;
  tradeAmount?: number;
  winRate?: number;
  profitUsd?: number;
  hoursBeforeEvent?: number;
  nameChanges?: number;
  marketDominance?: number;
  relativeBetSize?: number;
  [key: string]: unknown;
}
