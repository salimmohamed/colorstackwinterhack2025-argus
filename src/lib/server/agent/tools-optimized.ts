/**
 * Optimized Agent Tools
 * Shorter descriptions = fewer tokens per call
 */

import type { Tool } from "./types";

export const agentToolsOptimized: Tool[] = [
  {
    name: "fetch_market_activity",
    description: `Get recent trades for a market. Returns compressed data: trade amounts, addresses, timestamps. Includes market context (avg trade size, top traders). Use sinceTimestamp for incremental fetching.`,
    input_schema: {
      type: "object",
      properties: {
        marketId: { type: "string", description: "Market ID" },
        sinceTimestamp: {
          type: "number",
          description: "Only trades after this timestamp (optional)",
        },
      },
      required: ["marketId"],
    },
  },
  {
    name: "fetch_account_data",
    description: `Get account profile: age, trade count, volume, P&L, win rate, concentration. Returns cached data if recently analyzed. Includes quick flags: NEW, HIGH_WIN, CONCENTRATED, BIG_PROFIT, WHALE_TRADE.`,
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Wallet address" },
        forceRefresh: { type: "boolean", description: "Skip cache" },
      },
      required: ["address"],
    },
  },
  {
    name: "compare_to_market",
    description: `Compare trader to market context. Returns: relative bet size (vs avg), market dominance (%), rank, isWhale (5x+), isDominant (30%+).`,
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Wallet address" },
        marketId: { type: "string", description: "Market ID" },
      },
      required: ["address", "marketId"],
    },
  },
  {
    name: "flag_suspicious_account",
    description: `Flag account for investigation. Use after gathering evidence. Severity: low/medium/high/critical. Signal types: new_account_large_bet, timing_correlation, statistical_improbability, account_obfuscation, disproportionate_bet, pattern_match.`,
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string" },
        marketId: { type: "string" },
        severity: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
        },
        signalType: { type: "string" },
        title: { type: "string", description: "Brief title (max 50 chars)" },
        reasoning: {
          type: "string",
          description: "Key evidence (max 200 chars)",
        },
      },
      required: ["address", "severity", "signalType", "title", "reasoning"],
    },
  },
];

export default agentToolsOptimized;
