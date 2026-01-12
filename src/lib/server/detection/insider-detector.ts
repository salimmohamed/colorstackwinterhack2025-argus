/**
 * Insider Trading Detection Algorithm
 *
 * Based on real insider patterns (like the Maduro trader):
 * 1. PROFITABLE - Insiders make money, period. No profit = not insider.
 * 2. Fresh wallet - new account with minimal history
 * 3. Concentrated bets - only 2-3 specific markets (same topic)
 * 4. High win rate - they know what's going to happen
 * 5. Large positions - single bets >$10K
 *
 * Reference: Polysights bot detection criteria
 */

import { type ActivityRecord, dataApiClient } from "../polymarket/data-api";

export interface SuspectedInsider {
  wallet: string;
  displayName?: string;
  riskScore: number; // 0-100
  probability: number; // 0-1 (percentage likelihood of insider)
  flags: InsiderFlag[];
  evidence: Evidence[];
  profileUrl: string;
  // Core metrics
  totalProfit: number;
  totalVolume: number;
  winRate: number;
  accountAgeDays: number;
  totalTrades: number;
  // Enhanced metrics for AI analysis
  unrealizedProfit: number;
  avgPositionSize: number;
  largestWin: number;
  uniqueMarketsTraded: number;
  tradesPerDay: number;
  buyToSellRatio: number;
  avgTradeSize: number;
  recentActivitySpike: boolean;
}

export interface InsiderFlag {
  type:
    | "FRESH_WALLET"
    | "OVERSIZED_POSITION"
    | "HIGH_WIN_RATE"
    | "CONCENTRATED_BETS"
    | "SUSPICIOUS_TIMING"
    | "LARGE_PROFIT"
    | "MARKET_DOMINANCE"
    | "RELATIVE_SIZE";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  weight: number;
}

// Market context passed to trader analysis for relative comparisons
export interface MarketContext {
  conditionId: string;
  avgTradeSize: number;
  totalVolume: number;
  totalHolders: number;
  walletDominance: Map<string, number>; // wallet -> % of market they control
}

export interface Evidence {
  type: string;
  description: string;
  value: string | number;
  timestamp?: number;
}

// Detection thresholds based on real insider patterns
const THRESHOLDS = {
  // HARD REQUIREMENT: Must be profitable
  MIN_PROFIT_TO_FLAG: 1000, // $1K minimum profit to even consider

  // Fresh wallet (insiders use new accounts)
  FRESH_WALLET_MAX_TRADES: 20,
  FRESH_WALLET_MAX_AGE_DAYS: 30,

  // Position sizes (insiders go big) - ABSOLUTE thresholds (fallback)
  LARGE_POSITION_MIN_USD: 5000,
  WHALE_POSITION_MIN_USD: 10000,

  // RELATIVE position sizes (compared to market average)
  RELATIVE_SIZE_SUSPICIOUS: 3, // 3x market average = suspicious
  RELATIVE_SIZE_EXTREME: 5, // 5x market average = very suspicious
  RELATIVE_SIZE_WHALE: 10, // 10x market average = whale behavior

  // Market dominance (% of market controlled by single wallet)
  DOMINANCE_SUSPICIOUS: 0.3, // 30% of market
  DOMINANCE_HIGH: 0.5, // 50% of market
  DOMINANCE_EXTREME: 0.7, // 70% of market

  // Win rate (insiders know outcomes)
  HIGH_WIN_RATE_MIN: 0.7,
  SUSPICIOUS_WIN_RATE_MIN: 0.85,
  PERFECT_WIN_RATE: 0.95,
  MIN_POSITIONS_FOR_WIN_RATE: 2,

  // Concentration (insiders bet on specific topics)
  HIGHLY_CONCENTRATED_MAX_MARKETS: 3,
  CONCENTRATED_MAX_MARKETS: 5,

  // Profit tiers
  PROFIT_TIER_1: 1000, // $1K+
  PROFIT_TIER_2: 10000, // $10K+
  PROFIT_TIER_3: 50000, // $50K+
  PROFIT_TIER_4: 100000, // $100K+
};

/**
 * Calculate risk score for a trader based on their activity
 * REQUIRES positive profit to return a suspect
 * @param wallet - The wallet address to analyze
 * @param marketContext - Optional market context for relative comparisons
 */
export async function analyzeTrader(
  wallet: string,
  marketContext?: MarketContext,
): Promise<SuspectedInsider | null> {
  try {
    // Fetch trader data
    const [activity, positions, firstTradeTimestamp] = await Promise.all([
      dataApiClient.getAccountActivity(wallet, 500),
      dataApiClient.getUserPositions(wallet),
      dataApiClient.getAccountFirstTrade(wallet),
    ]);

    if (activity.length === 0) {
      return null;
    }

    // Calculate base metrics
    const stats = dataApiClient.calculateAccountStats(activity);
    const trades = activity.filter((a) => a.type === "TRADE");

    // Account age calculation with sanity checks
    // The API returns timestamp in seconds, convert to ms for Date comparison
    let accountAgeDays = firstTradeTimestamp
      ? Math.floor(
          (Date.now() - firstTradeTimestamp * 1000) / (1000 * 60 * 60 * 24),
        )
      : 0;

    // SANITY CHECK: If we have lots of trades but low days, the API is returning bad data
    // Estimate minimum account age from trade count (assume max ~100 trades/day for high-frequency trader)
    const minEstimatedAgeDays = Math.floor(stats.totalTrades / 100);
    if (accountAgeDays < minEstimatedAgeDays && stats.totalTrades > 50) {
      // API is returning incomplete history, use estimated age instead
      accountAgeDays = minEstimatedAgeDays;
      console.log(
        `[InsiderDetector] Corrected account age for ${wallet}: ${minEstimatedAgeDays} days (${stats.totalTrades} trades)`,
      );
    }

    // Win rate calculation (on closed positions)
    const closedPositions = positions.filter((p) => p.realizedPnl !== 0);
    const wins = closedPositions.filter((p) => p.realizedPnl > 0).length;
    const winRate =
      closedPositions.length >= THRESHOLDS.MIN_POSITIONS_FOR_WIN_RATE
        ? wins / closedPositions.length
        : 0;

    // Profit calculations
    const realizedProfit = positions.reduce(
      (sum, p) => sum + (p.realizedPnl || 0),
      0,
    );
    const unrealizedProfit = positions.reduce(
      (sum, p) => sum + (p.cashPnl || 0),
      0,
    );
    const totalProfit = realizedProfit + unrealizedProfit;
    // Note: largestWin uses realizedPnl only (closed positions) to identify proven winning trades
    // totalProfit includes unrealized to catch current suspicious positions, but largestWin focuses on track record
    const largestWin =
      positions.length > 0
        ? Math.max(...positions.map((p) => p.realizedPnl || 0))
        : 0;

    // ==========================================
    // SANITY CHECK: Filter out impossible/bad data
    // System accounts, test accounts, or corrupted API data
    // ==========================================
    const MAX_REALISTIC_PROFIT = 10_000_000; // $10M max realistic profit
    const MAX_REALISTIC_POSITION = 50_000_000; // $50M max position size
    const largestPosition =
      positions.length > 0 ? Math.max(...positions.map((p) => p.size || 0)) : 0;

    if (
      totalProfit > MAX_REALISTIC_PROFIT ||
      largestPosition > MAX_REALISTIC_POSITION
    ) {
      console.log(
        `[InsiderDetector] Skipping ${wallet.slice(0, 10)} - unrealistic data (profit: $${totalProfit.toLocaleString()}, largest pos: $${largestPosition.toLocaleString()})`,
      );
      return null; // Bad data, skip
    }

    // Skip accounts with 0 trades but huge positions (likely system accounts)
    if (stats.totalTrades === 0 && positions.length > 10) {
      console.log(
        `[InsiderDetector] Skipping ${wallet.slice(0, 10)} - 0 trades but ${positions.length} positions (system account)`,
      );
      return null;
    }

    // ==========================================
    // HARD FILTER: Must be profitable
    // Insiders make money. If you're losing, you're not an insider.
    // ==========================================
    if (totalProfit < THRESHOLDS.MIN_PROFIT_TO_FLAG) {
      return null; // Not profitable enough to be suspicious
    }

    // Position metrics
    const avgPositionSize =
      positions.length > 0
        ? positions.reduce((sum, p) => sum + (p.initialValue || 0), 0) /
          positions.length
        : 0;

    // Trade pattern metrics
    const buys = trades.filter((t) => t.side === "BUY").length;
    const sells = trades.filter((t) => t.side === "SELL").length;
    const buyToSellRatio = sells > 0 ? buys / sells : buys;
    const tradesPerDay =
      accountAgeDays > 0
        ? stats.totalTrades / accountAgeDays
        : stats.totalTrades;

    // Recent activity
    const oneDayAgo = Date.now() / 1000 - 86400;
    const recentTrades = trades.filter((t) => t.timestamp > oneDayAgo).length;
    const recentActivitySpike = recentTrades > 10;

    // Largest single trade
    const largestTrade =
      trades.length > 0 ? Math.max(...trades.map((t) => t.usdcSize ?? 0)) : 0;

    // Count unique markets - prefer activity data, use positions as supplement
    const uniqueMarketTitles = new Set(
      positions.map((p) => p.title || "").filter(Boolean),
    );
    const positionDiversityCount = uniqueMarketTitles.size;

    // Use the best available data: activity stats first, then position titles
    const effectiveMarketCount =
      stats.uniqueMarkets.length > 0
        ? stats.uniqueMarkets.length
        : positionDiversityCount > 0
          ? positionDiversityCount
          : 1; // Assume at least 1 market if we're analyzing them

    // ==========================================
    // SCORING: Only additive, no deductions
    // ==========================================
    const flags: InsiderFlag[] = [];
    const evidence: Evidence[] = [];

    // 1. PROFIT SCORE (most important - insiders make money)
    if (totalProfit >= THRESHOLDS.PROFIT_TIER_4) {
      flags.push({
        type: "LARGE_PROFIT",
        severity: "critical",
        description: `Massive profit of $${totalProfit.toLocaleString()}`,
        weight: 40,
      });
      evidence.push({
        type: "profit",
        description: "Exceptional profit indicating possible insider knowledge",
        value: `$${totalProfit.toLocaleString()}`,
      });
    } else if (totalProfit >= THRESHOLDS.PROFIT_TIER_3) {
      flags.push({
        type: "LARGE_PROFIT",
        severity: "critical",
        description: `Large profit of $${totalProfit.toLocaleString()}`,
        weight: 32,
      });
      evidence.push({
        type: "profit",
        description: "Very large profit",
        value: `$${totalProfit.toLocaleString()}`,
      });
    } else if (totalProfit >= THRESHOLDS.PROFIT_TIER_2) {
      flags.push({
        type: "LARGE_PROFIT",
        severity: "high",
        description: `Significant profit of $${totalProfit.toLocaleString()}`,
        weight: 22,
      });
      evidence.push({
        type: "profit",
        description: "Significant profit",
        value: `$${totalProfit.toLocaleString()}`,
      });
    } else if (totalProfit >= THRESHOLDS.PROFIT_TIER_1) {
      flags.push({
        type: "LARGE_PROFIT",
        severity: "medium",
        description: `Profit of $${totalProfit.toLocaleString()}`,
        weight: 12,
      });
      evidence.push({
        type: "profit",
        description: "Notable profit",
        value: `$${totalProfit.toLocaleString()}`,
      });
    }

    // 2. FRESH WALLET (insiders use new accounts)
    // Only flag low trade counts - high trade count = established trader
    if (stats.totalTrades <= 5) {
      flags.push({
        type: "FRESH_WALLET",
        severity: "critical",
        description: `Brand new account with only ${stats.totalTrades} trades`,
        weight: 28,
      });
      evidence.push({
        type: "account_activity",
        description: "Extremely limited trading history",
        value: stats.totalTrades,
      });
    } else if (stats.totalTrades <= 10) {
      flags.push({
        type: "FRESH_WALLET",
        severity: "high",
        description: `Very new account with ${stats.totalTrades} trades`,
        weight: 22,
      });
      evidence.push({
        type: "account_activity",
        description: "Very limited trading history",
        value: stats.totalTrades,
      });
    } else if (stats.totalTrades <= THRESHOLDS.FRESH_WALLET_MAX_TRADES) {
      flags.push({
        type: "FRESH_WALLET",
        severity: "medium",
        description: `New account with ${stats.totalTrades} trades`,
        weight: 14,
      });
      evidence.push({
        type: "account_activity",
        description: "Limited trading history",
        value: stats.totalTrades,
      });
    }

    // Account age scoring - BUT skip if trade count indicates established account
    // Someone with 100+ trades is NOT a fresh wallet regardless of what the API says
    const isEstablishedByTradeCount = stats.totalTrades > 50;

    if (!isEstablishedByTradeCount) {
      if (accountAgeDays <= 3) {
        flags.push({
          type: "FRESH_WALLET",
          severity: "critical",
          description: `Account created ${accountAgeDays} day${accountAgeDays === 1 ? "" : "s"} ago`,
          weight: 26,
        });
        evidence.push({
          type: "account_age",
          description: "Brand new account",
          value: `${accountAgeDays} days`,
        });
      } else if (accountAgeDays <= 7) {
        flags.push({
          type: "FRESH_WALLET",
          severity: "high",
          description: `Account is only ${accountAgeDays} days old`,
          weight: 20,
        });
        evidence.push({
          type: "account_age",
          description: "Very recently created account",
          value: `${accountAgeDays} days`,
        });
      } else if (accountAgeDays <= THRESHOLDS.FRESH_WALLET_MAX_AGE_DAYS) {
        flags.push({
          type: "FRESH_WALLET",
          severity: "medium",
          description: `Account is ${accountAgeDays} days old`,
          weight: 12,
        });
        evidence.push({
          type: "account_age",
          description: "Recently created account",
          value: `${accountAgeDays} days`,
        });
      }
    }

    // 3. CONCENTRATION (insiders bet on specific topics, not diversified)
    // Use effectiveMarketCount which considers both activity AND positions
    // Only flag if truly concentrated (not just missing data)
    if (effectiveMarketCount >= 1 && effectiveMarketCount === 1) {
      flags.push({
        type: "CONCENTRATED_BETS",
        severity: "critical",
        description: `All bets on single market`,
        weight: 35,
      });
      evidence.push({
        type: "concentration",
        description: "Extreme concentration - single market focus",
        value: "1 market",
      });
    } else if (
      effectiveMarketCount >= 1 &&
      effectiveMarketCount <= THRESHOLDS.HIGHLY_CONCENTRATED_MAX_MARKETS
    ) {
      flags.push({
        type: "CONCENTRATED_BETS",
        severity: "high",
        description: `Bets concentrated in ${effectiveMarketCount} markets`,
        weight: 26,
      });
      evidence.push({
        type: "concentration",
        description: "Highly concentrated betting",
        value: `${effectiveMarketCount} markets`,
      });
    } else if (
      effectiveMarketCount >= 1 &&
      effectiveMarketCount <= THRESHOLDS.CONCENTRATED_MAX_MARKETS
    ) {
      flags.push({
        type: "CONCENTRATED_BETS",
        severity: "medium",
        description: `Bets in only ${effectiveMarketCount} markets`,
        weight: 16,
      });
      evidence.push({
        type: "concentration",
        description: "Concentrated betting pattern",
        value: `${effectiveMarketCount} markets`,
      });
    }

    // 4. WIN RATE (insiders know outcomes)
    if (
      winRate >= THRESHOLDS.PERFECT_WIN_RATE &&
      closedPositions.length >= THRESHOLDS.MIN_POSITIONS_FOR_WIN_RATE
    ) {
      flags.push({
        type: "HIGH_WIN_RATE",
        severity: "critical",
        description: `Perfect/near-perfect ${(winRate * 100).toFixed(0)}% win rate on ${closedPositions.length} positions`,
        weight: 32,
      });
      evidence.push({
        type: "win_rate",
        description: "Statistically improbable perfect success",
        value: `${(winRate * 100).toFixed(0)}%`,
      });
    } else if (
      winRate >= THRESHOLDS.SUSPICIOUS_WIN_RATE_MIN &&
      closedPositions.length >= THRESHOLDS.MIN_POSITIONS_FOR_WIN_RATE
    ) {
      flags.push({
        type: "HIGH_WIN_RATE",
        severity: "high",
        description: `${(winRate * 100).toFixed(0)}% win rate across ${closedPositions.length} positions`,
        weight: 24,
      });
      evidence.push({
        type: "win_rate",
        description: "Extremely high success rate",
        value: `${(winRate * 100).toFixed(0)}%`,
      });
    } else if (
      winRate >= THRESHOLDS.HIGH_WIN_RATE_MIN &&
      closedPositions.length >= THRESHOLDS.MIN_POSITIONS_FOR_WIN_RATE
    ) {
      flags.push({
        type: "HIGH_WIN_RATE",
        severity: "medium",
        description: `${(winRate * 100).toFixed(0)}% win rate`,
        weight: 14,
      });
      evidence.push({
        type: "win_rate",
        description: "Above-average success rate",
        value: `${(winRate * 100).toFixed(0)}%`,
      });
    }

    // 5. LARGE POSITIONS - Now with RELATIVE sizing
    // If we have market context, use relative comparison (much better)
    // Otherwise fall back to absolute thresholds
    if (marketContext && marketContext.avgTradeSize > 0) {
      const relativeSize = largestTrade / marketContext.avgTradeSize;

      if (relativeSize >= THRESHOLDS.RELATIVE_SIZE_WHALE) {
        flags.push({
          type: "RELATIVE_SIZE",
          severity: "critical",
          description: `Trade ${relativeSize.toFixed(1)}x larger than market average`,
          weight: 28,
        });
        evidence.push({
          type: "relative_size",
          description: "Extreme outlier bet size vs market",
          value: `${relativeSize.toFixed(1)}x avg ($${largestTrade.toLocaleString()} vs $${marketContext.avgTradeSize.toLocaleString()} avg)`,
        });
      } else if (relativeSize >= THRESHOLDS.RELATIVE_SIZE_EXTREME) {
        flags.push({
          type: "RELATIVE_SIZE",
          severity: "high",
          description: `Trade ${relativeSize.toFixed(1)}x larger than market average`,
          weight: 20,
        });
        evidence.push({
          type: "relative_size",
          description: "Very large bet relative to market",
          value: `${relativeSize.toFixed(1)}x avg`,
        });
      } else if (relativeSize >= THRESHOLDS.RELATIVE_SIZE_SUSPICIOUS) {
        flags.push({
          type: "RELATIVE_SIZE",
          severity: "medium",
          description: `Trade ${relativeSize.toFixed(1)}x larger than market average`,
          weight: 12,
        });
        evidence.push({
          type: "relative_size",
          description: "Above-average bet size",
          value: `${relativeSize.toFixed(1)}x avg`,
        });
      }
    } else {
      // Fallback to absolute thresholds when no market context
      if (largestTrade >= THRESHOLDS.WHALE_POSITION_MIN_USD) {
        flags.push({
          type: "OVERSIZED_POSITION",
          severity: "high",
          description: `Placed single trade of $${largestTrade.toLocaleString()}`,
          weight: 20,
        });
        evidence.push({
          type: "large_trade",
          description: "Whale-sized single position",
          value: `$${largestTrade.toLocaleString()}`,
        });
      } else if (largestTrade >= THRESHOLDS.LARGE_POSITION_MIN_USD) {
        flags.push({
          type: "OVERSIZED_POSITION",
          severity: "medium",
          description: `Large trade of $${largestTrade.toLocaleString()}`,
          weight: 12,
        });
        evidence.push({
          type: "large_trade",
          description: "Large single position",
          value: `$${largestTrade.toLocaleString()}`,
        });
      }
    }

    // 6. MARKET DOMINANCE (new!)
    // Flag wallets that control large % of a market's positions
    if (marketContext) {
      const dominance =
        marketContext.walletDominance.get(wallet.toLowerCase()) || 0;

      if (dominance >= THRESHOLDS.DOMINANCE_EXTREME) {
        flags.push({
          type: "MARKET_DOMINANCE",
          severity: "critical",
          description: `Controls ${(dominance * 100).toFixed(0)}% of market positions`,
          weight: 30,
        });
        evidence.push({
          type: "dominance",
          description: "Extreme market control - potential manipulation",
          value: `${(dominance * 100).toFixed(0)}% of market`,
        });
      } else if (dominance >= THRESHOLDS.DOMINANCE_HIGH) {
        flags.push({
          type: "MARKET_DOMINANCE",
          severity: "high",
          description: `Controls ${(dominance * 100).toFixed(0)}% of market positions`,
          weight: 22,
        });
        evidence.push({
          type: "dominance",
          description: "High market control",
          value: `${(dominance * 100).toFixed(0)}% of market`,
        });
      } else if (dominance >= THRESHOLDS.DOMINANCE_SUSPICIOUS) {
        flags.push({
          type: "MARKET_DOMINANCE",
          severity: "medium",
          description: `Controls ${(dominance * 100).toFixed(0)}% of market positions`,
          weight: 14,
        });
        evidence.push({
          type: "dominance",
          description: "Significant market position",
          value: `${(dominance * 100).toFixed(0)}% of market`,
        });
      }
    }

    // Calculate overall risk score (sum of all flag weights)
    let riskScore = flags.reduce((sum, f) => sum + f.weight, 0);

    // REDUCE suspicion for established accounts (real insiders use fresh wallets)
    // Cap total penalty at 40 so high-risk accounts can still show as medium risk
    let totalPenalty = 0;

    // Account age penalty: older accounts are less suspicious
    if (accountAgeDays > 30) {
      const agePenalty = Math.min(
        25,
        Math.floor((accountAgeDays - 30) / 30) * 10,
      );
      totalPenalty += agePenalty;
    }

    // Trade count penalty: active traders are less suspicious
    if (stats.totalTrades > 100) {
      const tradePenalty = Math.min(
        20,
        Math.floor((stats.totalTrades - 100) / 100) * 10,
      );
      totalPenalty += tradePenalty;
    }

    // Apply capped penalty
    totalPenalty = Math.min(40, totalPenalty);
    if (totalPenalty > 0) {
      riskScore -= totalPenalty;
      evidence.push({
        type: "established_account",
        description: "Established account reduces insider likelihood",
        value: `${accountAgeDays} days, ${stats.totalTrades} trades (-${totalPenalty} risk)`,
      });
    }

    riskScore = Math.max(0, Math.min(100, riskScore));

    // Probability using sigmoid centered at 50
    const probability = 1 / (1 + Math.exp(-0.08 * (riskScore - 45)));

    // Get display name
    const displayName = activity[0]?.pseudonym || activity[0]?.name;

    return {
      wallet,
      displayName,
      riskScore,
      probability,
      flags,
      evidence,
      profileUrl: `https://polymarket.com/profile/${wallet}`,
      totalProfit,
      totalVolume: stats.totalVolume,
      winRate,
      accountAgeDays,
      totalTrades: stats.totalTrades,
      unrealizedProfit,
      avgPositionSize,
      largestWin,
      uniqueMarketsTraded: effectiveMarketCount,
      tradesPerDay,
      buyToSellRatio,
      avgTradeSize: stats.averageTradeSize,
      recentActivitySpike,
    };
  } catch (error) {
    console.error(`[InsiderDetector] Error analyzing trader ${wallet}:`, error);
    return null;
  }
}

/**
 * Analyze all top holders for a market and return suspected insiders
 */
export async function analyzeMarketForInsiders(
  conditionId: string,
  minRiskScore = 30,
): Promise<SuspectedInsider[]> {
  try {
    // Get top holders
    const holdersResponse = await dataApiClient.getMarketHolders(conditionId);

    // Get all unique wallets from holders
    const wallets = new Set<string>();
    const walletHoldings = new Map<string, number>(); // wallet -> total holdings value

    let totalMarketValue = 0;
    for (const response of holdersResponse) {
      for (const holder of response.holders) {
        wallets.add(holder.proxyWallet);
        // Track holdings for dominance calculation
        const currentHolding =
          walletHoldings.get(holder.proxyWallet.toLowerCase()) || 0;
        const holdingValue = holder.amount; // This is the position size
        walletHoldings.set(
          holder.proxyWallet.toLowerCase(),
          currentHolding + holdingValue,
        );
        totalMarketValue += holdingValue;
      }
    }

    // Also get recent trades for market context (but don't add ALL traders to analysis)
    const recentTrades = await dataApiClient.getMarketActivity(
      conditionId,
      168,
    ); // 7 days
    // Only add large traders from recent activity (over $1000)
    const getTradeValue = (t: ActivityRecord) => t.usdcSize ?? t.size * t.price;
    for (const trade of recentTrades) {
      if (getTradeValue(trade) >= 1000) {
        wallets.add(trade.proxyWallet);
      }
    }

    // Calculate market context for relative comparisons
    // Note: trades endpoint uses size * price for USD value, not usdcSize
    const avgTradeSize =
      recentTrades.length > 0
        ? recentTrades.reduce((sum, t) => sum + getTradeValue(t), 0) /
          recentTrades.length
        : 0;
    const totalVolume = recentTrades.reduce(
      (sum, t) => sum + getTradeValue(t),
      0,
    );

    // Calculate wallet dominance (% of market each wallet controls)
    const walletDominance = new Map<string, number>();
    if (totalMarketValue > 0) {
      for (const [wallet, holding] of walletHoldings) {
        walletDominance.set(wallet.toLowerCase(), holding / totalMarketValue);
      }
    }

    const marketContext: MarketContext = {
      conditionId,
      avgTradeSize,
      totalVolume,
      totalHolders: wallets.size,
      walletDominance,
    };

    console.log(
      `[InsiderDetector] Analyzing ${wallets.size} traders for market ${conditionId}`,
    );
    console.log(
      `[InsiderDetector] Market context: avg trade $${avgTradeSize.toFixed(0)}, ${recentTrades.length} trades, ${holdersResponse.reduce((s, r) => s + r.holders.length, 0)} holders`,
    );

    // Analyze traders with rate limiting
    const walletArray = Array.from(wallets);
    const analyses: (SuspectedInsider | null)[] = [];
    const batchSize = 5;

    for (let i = 0; i < walletArray.length; i += batchSize) {
      const batch = walletArray.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((wallet) => analyzeTrader(wallet, marketContext)),
      );
      // Extract successful results, treat failures as null
      analyses.push(
        ...batchResults.map((r) => (r.status === "fulfilled" ? r.value : null)),
      );
      if (i + batchSize < walletArray.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Filter: must be profitable (already done in analyzeTrader) and meet min score
    // Sort by PROFIT first (most important), then by risk score
    const suspected = analyses
      .filter(
        (a): a is SuspectedInsider => a !== null && a.riskScore >= minRiskScore,
      )
      .sort((a, b) => {
        // Primary sort: profit (descending)
        if (b.totalProfit !== a.totalProfit) {
          return b.totalProfit - a.totalProfit;
        }
        // Secondary sort: risk score (descending)
        return b.riskScore - a.riskScore;
      })
      .slice(0, 10);

    console.log(
      `[InsiderDetector] Found ${suspected.length} suspected insiders (profitable only)`,
    );

    return suspected;
  } catch (error) {
    console.error(`[InsiderDetector] Error analyzing market:`, error);
    return [];
  }
}

/**
 * Quick check if a trader looks suspicious
 */
export async function quickSuspicionCheck(wallet: string): Promise<{
  isSuspicious: boolean;
  reason?: string;
}> {
  try {
    const [activity, positions] = await Promise.all([
      dataApiClient.getAccountActivity(wallet, 50),
      dataApiClient.getUserPositions(wallet),
    ]);

    if (activity.length === 0) {
      return { isSuspicious: false };
    }

    // Calculate profit first
    const totalProfit = positions.reduce(
      (sum, p) => sum + (p.realizedPnl || 0) + (p.cashPnl || 0),
      0,
    );

    // Not profitable = not suspicious
    if (totalProfit < THRESHOLDS.MIN_PROFIT_TO_FLAG) {
      return { isSuspicious: false };
    }

    const trades = activity.filter((a) => a.type === "TRADE");
    const stats = dataApiClient.calculateAccountStats(activity);

    // Fresh wallet + profit = suspicious
    if (trades.length <= 10 && totalProfit >= 5000) {
      return {
        isSuspicious: true,
        reason: `New account (${trades.length} trades) with $${totalProfit.toLocaleString()} profit`,
      };
    }

    // Concentrated + profit = suspicious
    if (stats.uniqueMarkets.length <= 3 && totalProfit >= 5000) {
      return {
        isSuspicious: true,
        reason: `Concentrated bets (${stats.uniqueMarkets.length} markets) with $${totalProfit.toLocaleString()} profit`,
      };
    }

    return { isSuspicious: false };
  } catch (_error) {
    return { isSuspicious: false };
  }
}
