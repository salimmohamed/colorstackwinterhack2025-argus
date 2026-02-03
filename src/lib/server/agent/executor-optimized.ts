/**
 * Optimized Tool Executor
 *
 * Cost optimizations:
 * 1. Compressed outputs - only essential fields returned
 * 2. Incremental fetching - only new trades since checkpoint
 * 3. Pre-filtering - skip small trades, known accounts
 * 4. Cached context - reuse market stats
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { dataApiClient } from "../polymarket/data-api";
import { gammaClient } from "../polymarket/gamma";
import { subgraphClient } from "../polymarket/subgraph";
import type { AlertEvidence } from "./types";

// Convex client for saving flags
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Minimum trade size to analyze (skip noise)
const MIN_TRADE_SIZE_USD = 50; // Lowered to catch more trades

// Cache duration in milliseconds
const CONTEXT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const ACCOUNT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Cache slug -> conditionId resolutions (stores arrays for event slugs with multiple markets)
const slugToConditionIdCache = new Map<string, string[]>();

// In-memory caches (would be Convex in production)
const marketContextCache = new Map<
  string,
  { data: CompressedMarketContext; cachedAt: number }
>();
const accountCache = new Map<
  string,
  { data: CompressedAccountData; cachedAt: number }
>();
const analyzedAccounts = new Set<string>(); // Skip already-analyzed accounts

/**
 * COMPRESSED OUTPUT TYPES
 * These use ~60% fewer tokens than full outputs
 */

export interface CompressedMarketContext {
  id: string;
  q: string; // question (shortened key)
  avgTrade: number;
  vol24h: number;
  traders: number;
  topTraders: Array<{ addr: string; vol: number }>; // top 5 only
}

export interface CompressedTradeData {
  addr: string;
  amt: number;
  side: "B" | "S";
  ts: number;
  name?: string;
}

export interface CompressedAccountData {
  addr: string;
  name?: string;
  age: number | null; // days
  trades: number;
  vol: number;
  pnl: number;
  winRate: number;
  markets: number; // unique markets count
  largest: number; // largest trade
  flags: string[]; // detected flags
}

export interface CompressedMarketActivity {
  id: string;
  newTrades: CompressedTradeData[];
  context: CompressedMarketContext;
  checkpoint: number; // timestamp for next incremental fetch
}

export interface CompressedComparison {
  addr: string;
  relSize: number; // relative to market avg
  dominance: number; // % of market
  rank: number | null;
  isWhale: boolean;
  isDominant: boolean;
}

/**
 * Fetch market activity - INCREMENTAL & COMPRESSED
 */
export async function fetchMarketActivityOptimized(
  marketId: string,
  sinceTimestamp?: number,
  cachedContext?: CompressedMarketContext,
): Promise<CompressedMarketActivity> {
  // Use cached context if fresh
  let context = cachedContext;
  const cached = marketContextCache.get(marketId);

  if (
    !context &&
    cached &&
    Date.now() - cached.cachedAt < CONTEXT_CACHE_DURATION
  ) {
    context = cached.data;
  }

  // Resolve slug to condition IDs (Polymarket /trades API requires condition IDs)
  const conditionIds = await resolveConditionIds(marketId);
  const isSlug = conditionIds[0] !== marketId;
  if (isSlug) {
    console.log(`[Executor] Resolved "${marketId}" to ${conditionIds.length} condition IDs`);
  }

  // Fetch trades across all condition IDs (for events with multiple markets)
  const hoursBack = sinceTimestamp ? 168 : 72;
  // Limit concurrent fetches to avoid rate limiting
  const idsToFetch = conditionIds.slice(0, 10);
  console.log(
    `[Executor] Fetching trades from ${idsToFetch.length} market(s)...`,
  );

  const allActivity = (
    await Promise.all(
      idsToFetch.map((cid) =>
        dataApiClient.getMarketActivity(cid, hoursBack, MIN_TRADE_SIZE_USD),
      ),
    )
  ).flat();

  // Sort by timestamp descending
  allActivity.sort((a, b) => b.timestamp - a.timestamp);
  console.log(
    `[Executor] Got ${allActivity.length} trades (min $${MIN_TRADE_SIZE_USD})`,
  );

  // Filter to only trades after checkpoint
    const newTrades = sinceTimestamp
    ? allActivity.filter((a) => a.timestamp > sinceTimestamp)
    : allActivity;

  // Build context if not cached
  if (!context) {
    // Get event title for context
    let eventTitle = "Unknown";
    try {
      if (isSlug) {
        const event = await gammaClient.getEventBySlug(marketId);
        if (event?.title) eventTitle = event.title;
      } else {
        const market = await gammaClient.getMarketById(conditionIds[0]);
        if (market?.question) eventTitle = market.question;
      }
    } catch (_e) {
      console.log(
        `[Executor] Gamma API unavailable for ${marketId.slice(0, 10)}, using activity data`,
      );
    }

    const totalVol = allActivity.reduce(
      (s, t) => s + (t.usdcSize ?? t.size * t.price),
      0,
    );
    const avgTrade = allActivity.length > 0 ? totalVol / allActivity.length : 0;

    // Top 5 traders only
    const traderVols = new Map<string, number>();
    for (const t of allActivity) {
      const cur = traderVols.get(t.proxyWallet) || 0;
      traderVols.set(t.proxyWallet, cur + (t.usdcSize ?? t.size * t.price));
    }
    const topTraders = [...traderVols.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([addr, vol]) => ({ addr, vol: Math.round(vol) }));

    context = {
      id: marketId,
      q: eventTitle.slice(0, 50),
      avgTrade: Math.round(avgTrade),
      vol24h: Math.round(totalVol),
      traders: new Set(allActivity.map((a) => a.proxyWallet)).size,
      topTraders,
    };

    // Cache it
    marketContextCache.set(marketId, { data: context, cachedAt: Date.now() });
  }

  // Compress trades - only essential fields
  // Keep full addresses so agent can use them for lookups
  const compressedTrades: CompressedTradeData[] = newTrades
    .slice(0, 50) // Limit to 50 most recent
    .map((t) => ({
      addr: t.proxyWallet, // Full address for agent to use
      amt: Math.round(t.usdcSize ?? t.size * t.price),
      side: t.side === "BUY" ? "B" : "S",
      ts: t.timestamp,
      name: t.name || t.pseudonym || undefined,
    }));

  return {
    id: marketId,
    newTrades: compressedTrades,
    context,
    checkpoint: allActivity[0]?.timestamp || Date.now(),
  };
}

/**
 * Fetch account data - CACHED & COMPRESSED
 */
export async function fetchAccountDataOptimized(
  address: string,
  forceRefresh = false,
): Promise<CompressedAccountData | { cached: true; summary: string }> {
  // Check if already analyzed this session
  if (!forceRefresh && analyzedAccounts.has(address.toLowerCase())) {
    return {
      cached: true,
      summary: `Account ${address.slice(0, 10)} already analyzed this session`,
    };
  }

  // Check cache
  const cached = accountCache.get(address.toLowerCase());
  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.cachedAt < ACCOUNT_CACHE_DURATION
  ) {
    return cached.data;
  }

  // Fetch fresh data
  const [activity, positions] = await Promise.all([
    dataApiClient.getAccountActivity(address, 200), // Reduced from 500
    dataApiClient.getUserPositions(address),
  ]);

  const trades = activity.filter((a) => a.type === "TRADE");
  const accountAge = await subgraphClient.getAccountAgeDays(address);

  // Calculate stats
  const totalVol = trades.reduce((s, t) => s + t.usdcSize, 0);
  const pnl = positions.reduce(
    (s, p) => s + (p.realizedPnl || 0) + (p.cashPnl || 0),
    0,
  );
  const closedPos = positions.filter((p) => p.realizedPnl !== 0);
  const wins = closedPos.filter((p) => p.realizedPnl > 0).length;
  const winRate = closedPos.length >= 2 ? wins / closedPos.length : 0;
  const uniqueMarkets = new Set(trades.map((t) => t.conditionId)).size;
  const largest = Math.max(...trades.map((t) => t.usdcSize), 0);

  // Quick flag detection
  const flags: string[] = [];
  if (trades.length <= 10) flags.push("NEW");
  if (winRate >= 0.85 && closedPos.length >= 5) flags.push("HIGH_WIN");
  if (uniqueMarkets <= 2 && trades.length >= 5) flags.push("CONCENTRATED");
  if (pnl >= 10000) flags.push("BIG_PROFIT");
  if (largest >= 5000) flags.push("WHALE_TRADE");

  const result: CompressedAccountData = {
    addr: address, // Store full address, truncate only for display
    name: trades[0]?.name || trades[0]?.pseudonym,
    age: accountAge,
    trades: trades.length,
    vol: Math.round(totalVol),
    pnl: Math.round(pnl),
    winRate: Math.round(winRate * 100) / 100,
    markets: uniqueMarkets,
    largest: Math.round(largest),
    flags,
  };

  // Cache it
  accountCache.set(address.toLowerCase(), {
    data: result,
    cachedAt: Date.now(),
  });
  analyzedAccounts.add(address.toLowerCase());

  return result;
}

/**
 * Resolve a slug to condition IDs.
 * Slugs can be either market slugs or event slugs (which contain multiple markets).
 * Returns an array of condition IDs to analyze.
 */
async function resolveConditionIds(marketId: string): Promise<string[]> {
  if (/^0x[0-9a-fA-F]+$/.test(marketId)) return [marketId];
  const cached = slugToConditionIdCache.get(marketId);
  if (cached) return cached;

  // Try as market slug first
  const market = await gammaClient.getMarketBySlug(marketId);
  if (market?.conditionId) {
    slugToConditionIdCache.set(marketId, [market.conditionId]);
    return [market.conditionId];
  }

  // Try as event slug — returns multiple markets
  const event = await gammaClient.getEventBySlug(marketId);
  if (event?.markets?.length) {
    const ids = event.markets
      .filter((m: { conditionId: string }) => m.conditionId)
      .map((m: { conditionId: string }) => m.conditionId);
    if (ids.length > 0) {
      slugToConditionIdCache.set(marketId, ids);
    }
    console.log(`[Executor] Event "${marketId}" has ${ids.length} markets`);
    return ids;
  }

  console.warn(`[Executor] Could not resolve "${marketId}" to any condition IDs`);
  return [marketId];
}

/**
 * Compare to market - COMPRESSED
 */
export async function compareToMarketOptimized(
  address: string,
  marketId: string,
): Promise<CompressedComparison> {
  const conditionIds = await resolveConditionIds(marketId);
  const conditionIdSet = new Set(conditionIds.map((id) => id.toLowerCase()));
  const marketData = await fetchMarketActivityOptimized(marketId);
  // Get holders from first condition ID (representative)
  const holders = await dataApiClient.getMarketHolders(conditionIds[0]);

  // Find trader's volume across all sub-markets
  const accountActivity = await dataApiClient.getAccountActivity(address, 100);
  const marketTrades = accountActivity.filter(
    (a) => conditionIdSet.has(a.conditionId?.toLowerCase()),
  );
  const traderLargest = Math.max(...marketTrades.map((t) => t.usdcSize), 0);

  // Relative size
  const relSize =
    marketData.context.avgTrade > 0
      ? traderLargest / marketData.context.avgTrade
      : 0;

  // Market dominance
  let totalHoldings = 0;
  let traderHoldings = 0;
  for (const resp of holders) {
    for (const h of resp.holders) {
      totalHoldings += h.amount;
      if (h.proxyWallet.toLowerCase() === address.toLowerCase()) {
        traderHoldings += h.amount;
      }
    }
  }
  const dominance = totalHoldings > 0 ? traderHoldings / totalHoldings : 0;

  // Rank - compare full addresses for reliable matching
  const rank = marketData.context.topTraders.findIndex(
    (t) => t.addr.toLowerCase() === address.toLowerCase(),
  );

  return {
    addr: address.slice(0, 10),
    relSize: Math.round(relSize * 10) / 10,
    dominance: Math.round(dominance * 100) / 100,
    rank: rank >= 0 ? rank + 1 : null,
    isWhale: relSize >= 5,
    isDominant: dominance >= 0.3,
  };
}

/**
 * Map signal type string to schema enum
 */
function mapSignalType(
  signalType: string,
):
  | "new_account_large_bet"
  | "timing_correlation"
  | "statistical_improbability"
  | "account_obfuscation"
  | "disproportionate_bet"
  | "pattern_match" {
  const type = signalType.toLowerCase();
  if (type.includes("new") || type.includes("fresh"))
    return "new_account_large_bet";
  if (type.includes("timing")) return "timing_correlation";
  if (type.includes("win") || type.includes("statistical"))
    return "statistical_improbability";
  if (type.includes("obfuscate") || type.includes("name"))
    return "account_obfuscation";
  if (type.includes("large") || type.includes("whale") || type.includes("size"))
    return "disproportionate_bet";
  return "pattern_match";
}

/**
 * Calculate trade count penalty (higher trades = lower risk)
 * Returns negative number to subtract from risk score
 */
function calculateTradeCountPenalty(trades: number): number {
  if (trades <= 10) return 0;
  if (trades <= 25) return -5;
  if (trades <= 50) return -12;
  if (trades <= 100) return -22;
  if (trades <= 200) return -35;
  if (trades <= 350) return -45;
  if (trades <= 500) return -52;
  return -60; // 500+ trades - heavy penalty
}

/**
 * Map risk score to severity
 */
function scoreToSeverity(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 55) return "medium";
  return "low";
}

/**
 * Flag account - SAVES TO CONVEX
 * Applies hard filters and trade count penalties
 */
export async function flagSuspiciousAccountOptimized(params: {
  address: string;
  marketId?: string;
  severity: "low" | "medium" | "high" | "critical";
  signalType: string;
  title: string;
  reasoning: string;
  evidence?: AlertEvidence;
}): Promise<{ success: boolean; id: string }> {
  // Normalize address at entry for consistent handling
  const normalizedAddress = params.address.toLowerCase();
  console.log(
    "[Agent] FLAG:",
    params.severity,
    normalizedAddress.slice(0, 10),
    params.title,
  );

  try {
    // Get account data from cache
    const accountData = accountCache.get(normalizedAddress)?.data;
    const fullAddress = accountData?.addr || normalizedAddress;
    const tradeCount = accountData?.trades || 0;
    const accountProfit = accountData?.pnl || 0;
    const uniqueMarkets = accountData?.markets || 0;

    // HARD FILTER 1: Reject accounts with 350+ trades (professional traders)
    if (tradeCount >= 350) {
      console.log(
        `[Agent] REJECTED FLAG: ${normalizedAddress.slice(0, 10)} - ${tradeCount} trades (professional trader)`,
      );
      return { success: false, id: "rejected_high_trades" };
    }

    // HARD FILTER 2: Reject accounts with negative or low profit
    const MIN_PROFIT_TO_FLAG = 100; // $100 minimum
    if (accountProfit < MIN_PROFIT_TO_FLAG) {
      console.log(
        `[Agent] REJECTED FLAG: ${normalizedAddress.slice(0, 10)} - profit $${accountProfit.toLocaleString()} below threshold`,
      );
      return { success: false, id: "rejected_low_profit" };
    }

    // HARD FILTER 3: Reject highly diversified accounts (10+ markets)
    if (uniqueMarkets >= 10) {
      console.log(
        `[Agent] REJECTED FLAG: ${normalizedAddress.slice(0, 10)} - ${uniqueMarkets} markets (diversified trader)`,
      );
      return { success: false, id: "rejected_diversified" };
    }

    // Calculate adjusted risk score with trade count penalty
    const metrics = params.evidence?.metrics as Record<string, unknown> | undefined;
    const originalScore = (metrics?.riskScore as number) || 50;
    const tradeCountPenalty = calculateTradeCountPenalty(tradeCount);
    const adjustedScore = Math.max(0, Math.min(100, originalScore + tradeCountPenalty));

    // HARD FILTER 4: Reject if adjusted score is too low
    if (adjustedScore < 40) {
      console.log(
        `[Agent] REJECTED FLAG: ${normalizedAddress.slice(0, 10)} - adjusted score ${adjustedScore} (original: ${originalScore}, penalty: ${tradeCountPenalty})`,
      );
      return { success: false, id: "rejected_low_score" };
    }

    // Recalculate severity based on adjusted score
    const adjustedSeverity = scoreToSeverity(adjustedScore);

    console.log(
      `[Agent] Score adjustment: ${originalScore} + (${tradeCountPenalty}) = ${adjustedScore} → ${adjustedSeverity}`,
    );

    // Upsert account
    const accountId = await convex.mutation(api.accounts.upsert, {
      address: fullAddress.toLowerCase(),
      displayName: accountData?.name || undefined,
      totalTrades: tradeCount,
      totalVolume: accountData?.vol || 0,
      winRate: accountData?.winRate || 0,
      riskScore: adjustedScore,
      flags: accountData?.flags || [params.signalType],
    });

    // Create alert with adjusted score and severity
    await convex.mutation(api.alerts.create, {
      accountId,
      severity: adjustedSeverity,
      signalType: mapSignalType(params.signalType),
      title: params.title,
      description: params.reasoning,
      evidence: {
        metrics: {
          riskScore: adjustedScore,
          originalRiskScore: originalScore,
          tradeCountPenalty: tradeCountPenalty,
          totalProfit: accountProfit,
          totalVolume: accountData?.vol || 0,
          winRate: accountData?.winRate || 0,
          accountAgeDays: accountData?.age || 0,
          totalTrades: tradeCount,
          uniqueMarketsTraded: uniqueMarkets,
        },
        reasoning: params.reasoning,
      },
    });

    console.log("[Agent] Saved to Convex:", accountId);
    return { success: true, id: accountId };
  } catch (error) {
    console.error("[Agent] Error saving to Convex:", error);
    return { success: false, id: `error_${Date.now()}` };
  }
}

/**
 * Execute optimized tool
 */
export async function executeOptimizedTool(
  toolName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case "fetch_market_activity":
      return fetchMarketActivityOptimized(
        input.marketId as string,
        input.sinceTimestamp as number | undefined,
      );

    case "fetch_account_data":
      return fetchAccountDataOptimized(
        input.address as string,
        input.forceRefresh as boolean | undefined,
      );

    case "compare_to_market":
      return compareToMarketOptimized(
        input.address as string,
        input.marketId as string,
      );

    case "flag_suspicious_account":
      return flagSuspiciousAccountOptimized({
        address: input.address as string,
        marketId: input.marketId as string | undefined,
        severity: input.severity as "low" | "medium" | "high" | "critical",
        signalType: input.signalType as string,
        title: input.title as string,
        reasoning: input.reasoning as string,
        evidence: input.evidence as AlertEvidence | undefined,
      });

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Clear caches (call between runs if needed)
 */
export function clearCaches() {
  marketContextCache.clear();
  accountCache.clear();
  analyzedAccounts.clear();
  slugToConditionIdCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return {
    marketContexts: marketContextCache.size,
    accounts: accountCache.size,
    analyzedThisSession: analyzedAccounts.size,
  };
}
