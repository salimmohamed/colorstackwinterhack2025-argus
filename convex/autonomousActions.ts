/**
 * Autonomous Actions for Scheduled Jobs
 *
 * These actions are called by crons to run autonomously:
 * - Market sync from Polymarket (every 30 min)
 * - Rules-based detection (every 2 hours)
 * - AI agent analysis (every 12 hours)
 */

import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

// =============================================================================
// MARKET SYNC ACTION
// =============================================================================

interface GammaMarket {
  id: string;
  question: string | null;
  conditionId: string;
  slug: string | null;
  outcomePrices: string | string[];
}

interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  volume: number;
  markets: GammaMarket[];
  active: boolean;
  endDate: string | null;
}

/**
 * Fetch political events from Gamma API
 */
async function fetchPoliticalEvents(limit = 10): Promise<GammaEvent[]> {
  const url = `${GAMMA_API_BASE}/events?active=true&closed=false&limit=100`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Gamma API error: ${response.status}`);
  }

  const events: GammaEvent[] = await response.json();

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

  const politicalEvents = events.filter((event) => {
    const title = event.title.toLowerCase();
    return politicalKeywords.some((kw) => title.includes(kw));
  });

  politicalEvents.sort((a, b) => b.volume - a.volume);
  return politicalEvents.slice(0, limit);
}

/**
 * Extract candidate name from market question
 */
function extractCandidateName(market: GammaMarket): string {
  if (market.question) {
    const cleanedQuestion = market.question
      .replace(/\s+\d{2,6}\s+\d{2,6}$/i, "")
      .replace(/\s+\d{6,}$/i, "")
      .trim();

    const willMatch = cleanedQuestion.match(
      /^Will\s+(.+?)\s+(win|become|be)\b/i,
    );
    if (willMatch) return willMatch[1].trim();

    const toMatch = cleanedQuestion.match(/^(.+?)\s+to\s+(win|become|be)\b/i);
    if (toMatch) return toMatch[1].trim();

    return cleanedQuestion;
  }

  if (market.slug) {
    return market.slug
      .replace(/-wins?-.*$/i, "")
      .replace(/-2028.*$/i, "")
      .replace(/-/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return "Unknown";
}

/**
 * Check if market is a placeholder
 */
function isPlaceholderMarket(market: GammaMarket): boolean {
  if (!market.question) return false;
  const q = market.question.toLowerCase();
  return (
    /\bperson\s+[a-z]{1,2}\b/i.test(market.question) ||
    q.includes("another person")
  );
}

/**
 * Sync markets from Polymarket Gamma API
 * Called every 30 minutes by cron
 */
export const syncMarketsFromPolymarket = internalAction({
  args: {},
  handler: async (ctx): Promise<{ synced: number; failed: number }> => {
    console.log("[Cron] Starting market sync from Polymarket...");

    try {
      const events = await fetchPoliticalEvents(10);
      console.log(`[Cron] Fetched ${events.length} political events`);

      let synced = 0;
      let failed = 0;

      for (const event of events) {
        try {
          const realMarkets = event.markets.filter(
            (m) => !isPlaceholderMarket(m),
          );

          const outcomes = realMarkets.map((market) => {
            let price = 0;
            try {
              let prices: string[] = [];
              if (typeof market.outcomePrices === "string") {
                prices = JSON.parse(market.outcomePrices);
              } else if (Array.isArray(market.outcomePrices)) {
                prices = market.outcomePrices;
              }
              const priceStr = prices[0];
              if (priceStr?.trim()) {
                const parsed = parseFloat(priceStr);
                if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
                  price = parsed;
                }
              }
            } catch {
              // Ignore parse errors
            }
            return {
              name: extractCandidateName(market),
              tokenId: market.conditionId,
              price,
            };
          });

          outcomes.sort((a, b) => b.price - a.price);

          await ctx.runMutation(internal.autonomousActions.upsertMarket, {
            polymarketId: event.id,
            slug: event.slug,
            question: event.title,
            category: "politics",
            endDate: event.endDate
              ? new Date(event.endDate).getTime()
              : undefined,
            isActive: event.active,
            totalVolume: event.volume,
            outcomes: outcomes.slice(0, 5),
          });

          synced++;
        } catch (error) {
          console.error(`[Cron] Failed to sync event ${event.slug}:`, error);
          failed++;
        }
      }

      // Log to activity feed
      await ctx.runMutation(internal.autonomousActions.logActivity, {
        type: "market_synced",
        payload: { marketsUpdated: synced },
      });

      console.log(`[Cron] Market sync complete: ${synced} synced, ${failed} failed`);
      return { synced, failed };
    } catch (error) {
      console.error("[Cron] Market sync failed:", error);
      throw error;
    }
  },
});

/**
 * Internal mutation to upsert a market
 */
export const upsertMarket = internalMutation({
  args: {
    polymarketId: v.string(),
    slug: v.string(),
    question: v.string(),
    category: v.string(),
    endDate: v.optional(v.number()),
    isActive: v.boolean(),
    totalVolume: v.number(),
    outcomes: v.array(
      v.object({
        name: v.string(),
        tokenId: v.string(),
        price: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("markets")
      .withIndex("by_polymarket_id", (q) =>
        q.eq("polymarketId", args.polymarketId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("markets", {
      ...args,
      lastSyncedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to log activity
 */
export const logActivity = internalMutation({
  args: {
    type: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { type, payload }) => {
    await ctx.db.insert("activityFeed", {
      type: type as
        | "alert_created"
        | "agent_started"
        | "agent_completed"
        | "market_synced"
        | "detection_completed",
      payload,
      timestamp: Date.now(),
    });
  },
});

// =============================================================================
// RULES-BASED DETECTION ACTION
// =============================================================================

const DATA_API_BASE = "https://data-api.polymarket.com";

interface TradeData {
  proxyWallet: string;
  usdcSize: string | number;
  side: string;
  timestamp: string;
  outcome: string;
}

/**
 * Fetch recent trades for a market
 */
async function fetchMarketTrades(
  conditionId: string,
  limit = 100,
): Promise<TradeData[]> {
  const url = `${DATA_API_BASE}/trades?market=${conditionId}&limit=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    console.warn(`[Detection] Failed to fetch trades for ${conditionId}`);
    return [];
  }

  return response.json();
}

/**
 * Simple rules-based detection for suspicious patterns
 */
function analyzeTradesForSuspiciousActivity(
  trades: TradeData[],
  conditionId: string,
): Array<{
  wallet: string;
  riskScore: number;
  flags: string[];
  totalVolume: number;
}> {
  const walletStats = new Map<
    string,
    {
      trades: number;
      volume: number;
      sides: Set<string>;
    }
  >();

  // Aggregate by wallet
  for (const trade of trades) {
    const wallet = trade.proxyWallet.toLowerCase();
    const volume =
      typeof trade.usdcSize === "string"
        ? parseFloat(trade.usdcSize)
        : trade.usdcSize ?? 0;

    const stats = walletStats.get(wallet) || {
      trades: 0,
      volume: 0,
      sides: new Set<string>(),
    };
    stats.trades++;
    stats.volume += volume;
    stats.sides.add(trade.side);
    walletStats.set(wallet, stats);
  }

  const suspects: Array<{
    wallet: string;
    riskScore: number;
    flags: string[];
    totalVolume: number;
  }> = [];

  for (const [wallet, stats] of walletStats) {
    const flags: string[] = [];
    let riskScore = 0;

    // Large volume flag
    if (stats.volume > 10000) {
      flags.push("LARGE_VOLUME");
      riskScore += 20;
    }
    if (stats.volume > 50000) {
      flags.push("VERY_LARGE_VOLUME");
      riskScore += 30;
    }

    // Concentrated betting (only one side)
    if (stats.sides.size === 1 && stats.trades >= 3) {
      flags.push("CONCENTRATED_BETS");
      riskScore += 15;
    }

    // High trade frequency
    if (stats.trades >= 10) {
      flags.push("HIGH_FREQUENCY");
      riskScore += 10;
    }

    if (riskScore >= 30) {
      suspects.push({
        wallet,
        riskScore,
        flags,
        totalVolume: stats.volume,
      });
    }
  }

  return suspects.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Run rules-based detection on all active markets
 * Called every 2 hours by cron
 */
export const runRulesDetection = internalAction({
  args: {},
  handler: async (ctx): Promise<{ marketsAnalyzed: number; suspectsFound: number }> => {
    console.log("[Cron] Starting rules-based detection...");

    try {
      // Get active markets
      const markets = await ctx.runQuery(internal.autonomousActions.getActiveMarkets, {});
      console.log(`[Cron] Analyzing ${markets.length} active markets`);

      let totalSuspects = 0;

      for (const market of markets.slice(0, 5)) {
        // Limit to 5 markets per run
        const conditionId = market.outcomes[0]?.tokenId;
        if (!conditionId) continue;

        try {
          const trades = await fetchMarketTrades(conditionId);
          const suspects = analyzeTradesForSuspiciousActivity(
            trades,
            conditionId,
          );

          for (const suspect of suspects) {
            // Upsert account
            await ctx.runMutation(internal.autonomousActions.upsertSuspect, {
              address: suspect.wallet,
              riskScore: suspect.riskScore,
              flags: suspect.flags,
              totalVolume: suspect.totalVolume,
            });
            totalSuspects++;
          }

          // Rate limit
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`[Cron] Error analyzing market ${market.slug}:`, error);
        }
      }

      // Log to activity feed
      await ctx.runMutation(internal.autonomousActions.logActivity, {
        type: "detection_completed",
        payload: { mode: "rules", suspectsFound: totalSuspects },
      });

      console.log(`[Cron] Rules detection complete: ${totalSuspects} suspects found`);
      return { marketsAnalyzed: markets.length, suspectsFound: totalSuspects };
    } catch (error) {
      console.error("[Cron] Rules detection failed:", error);
      throw error;
    }
  },
});

/**
 * Query to get active markets
 */
import { internalQuery } from "./_generated/server";

export const getActiveMarkets = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("markets")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

/**
 * Upsert a suspect account
 */
export const upsertSuspect = internalMutation({
  args: {
    address: v.string(),
    riskScore: v.number(),
    flags: v.array(v.string()),
    totalVolume: v.number(),
  },
  handler: async (ctx, { address, riskScore, flags, totalVolume }) => {
    const normalizedAddress = address.toLowerCase();
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_address", (q) => q.eq("address", normalizedAddress))
      .first();

    const now = Date.now();

    if (existing) {
      // Only update if new risk score is higher
      if (riskScore > existing.riskScore) {
        await ctx.db.patch(existing._id, {
          riskScore,
          flags,
          totalVolume,
          isFlagged: riskScore >= 50,
          lastActivityAt: now,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("accounts", {
      address: normalizedAddress,
      displayName: undefined,
      previousNames: [],
      firstSeenAt: now,
      createdAt: now,
      totalTrades: 0,
      totalVolume,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      riskScore,
      flags,
      lastActivityAt: now,
      isFlagged: riskScore >= 50,
    });
  },
});

// =============================================================================
// AI AGENT TRIGGER ACTION
// =============================================================================

/**
 * Trigger the AI agent via HTTP call to Next.js API
 * Called every 12 hours by cron
 *
 * Note: Requires APP_URL environment variable to be set in Convex
 */
export const triggerAIAgent = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
    console.log("[Cron] Triggering AI agent analysis...");

    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      console.warn("[Cron] APP_URL not configured, skipping AI agent trigger");
      return { success: false, error: "APP_URL not configured" };
    }

    try {
      // Create agent run record
      const runId = await ctx.runMutation(
        internal.autonomousActions.createAgentRun,
        {},
      );

      // Call the Next.js API
      const response = await fetch(`${appUrl}/api/agent/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optimized: true,
          maxIterations: 10,
        }),
      });

      if (!response.ok) {
        const error = `API error: ${response.status}`;
        await ctx.runMutation(internal.autonomousActions.failAgentRun, {
          runId,
          error,
        });
        return { success: false, error };
      }

      const result = await response.json();

      // Update run with results
      await ctx.runMutation(internal.autonomousActions.completeAgentRun, {
        runId,
        accountsAnalyzed: result.accountsAnalyzed || 0,
        alertsGenerated: result.flagsCreated || 0,
        tokensUsed: result.tokensUsed || { input: 0, output: 0 },
      });

      console.log("[Cron] AI agent completed successfully");
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[Cron] AI agent trigger failed:", message);
      return { success: false, error: message };
    }
  },
});

/**
 * Create an agent run record
 */
export const createAgentRun = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const runId = await ctx.db.insert("agentRuns", {
      startedAt: now,
      completedAt: undefined,
      status: "running",
      triggerType: "scheduled",
      marketIds: [],
      accountsAnalyzed: 0,
      alertsGenerated: 0,
      toolCalls: [],
      tokensUsed: { input: 0, output: 0 },
      error: undefined,
    });

    await ctx.db.insert("activityFeed", {
      type: "agent_started",
      payload: { runId, triggerType: "scheduled" },
      timestamp: now,
    });

    return runId;
  },
});

/**
 * Mark agent run as complete
 */
export const completeAgentRun = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    accountsAnalyzed: v.number(),
    alertsGenerated: v.number(),
    tokensUsed: v.object({
      input: v.number(),
      output: v.number(),
    }),
  },
  handler: async (ctx, { runId, accountsAnalyzed, alertsGenerated, tokensUsed }) => {
    const now = Date.now();

    await ctx.db.patch(runId, {
      status: "completed",
      completedAt: now,
      accountsAnalyzed,
      alertsGenerated,
      tokensUsed,
    });

    await ctx.db.insert("activityFeed", {
      type: "agent_completed",
      payload: { runId, accountsAnalyzed, alertsGenerated },
      timestamp: now,
    });
  },
});

/**
 * Mark agent run as failed
 */
export const failAgentRun = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    error: v.string(),
  },
  handler: async (ctx, { runId, error }) => {
    await ctx.db.patch(runId, {
      status: "failed",
      completedAt: Date.now(),
      error,
    });
  },
});
