import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

// Severity and status validators
const severityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical")
);

const statusValidator = v.union(
  v.literal("new"),
  v.literal("investigating"),
  v.literal("confirmed"),
  v.literal("dismissed")
);

const signalTypeValidator = v.union(
  v.literal("new_account_large_bet"),
  v.literal("timing_correlation"),
  v.literal("statistical_improbability"),
  v.literal("account_obfuscation"),
  v.literal("disproportionate_bet"),
  v.literal("pattern_match")
);

// Evidence validator with typed metrics
const evidenceValidator = v.object({
  metrics: v.object({
    riskScore: v.optional(v.number()),
    originalRiskScore: v.optional(v.number()),
    tradeCountPenalty: v.optional(v.number()),
    probability: v.optional(v.number()),
    totalProfit: v.optional(v.number()),
    totalVolume: v.optional(v.number()),
    winRate: v.optional(v.number()),
    accountAgeDays: v.optional(v.number()),
    totalTrades: v.optional(v.number()),
    uniqueMarketsTraded: v.optional(v.number()),
  }),
  reasoning: v.string(),
});

// Alert validator for return types
const alertValidator = v.object({
  _id: v.id("alerts"),
  _creationTime: v.number(),
  accountId: v.id("accounts"),
  accountAddress: v.string(),
  marketId: v.optional(v.id("markets")),
  severity: severityValidator,
  signalType: signalTypeValidator,
  title: v.string(),
  description: v.string(),
  evidence: evidenceValidator,
  status: statusValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  agentRunId: v.optional(v.id("agentRuns")),
});

// List recent alerts
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(alertValidator),
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_created")
      .order("desc")
      .take(limit ?? 50);
  },
});

// List alerts by severity
export const listBySeverity = query({
  args: { severity: severityValidator },
  returns: v.array(alertValidator),
  handler: async (ctx, { severity }) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_severity", (q) => q.eq("severity", severity))
      .collect();
  },
});

// List alerts for a specific account
export const listByAccount = query({
  args: { accountId: v.id("accounts") },
  returns: v.array(alertValidator),
  handler: async (ctx, { accountId }) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .collect();
  },
});

// Get a single alert by ID
export const get = query({
  args: { id: v.id("alerts") },
  returns: v.union(alertValidator, v.null()),
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Create a new alert (with deduplication)
export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    marketId: v.optional(v.id("markets")),
    severity: severityValidator,
    signalType: signalTypeValidator,
    title: v.string(),
    description: v.string(),
    evidence: evidenceValidator,
    agentRunId: v.optional(v.id("agentRuns")),
  },
  returns: v.id("alerts"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Get account address for denormalized display
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error(`Account not found: ${args.accountId}`);

    // Check for existing alert for this account within dedup window
    const existingAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .filter((q) => q.gt(q.field("createdAt"), now - DEDUP_WINDOW_MS))
      .collect();

    // If there's a recent alert for this account, update it instead of creating duplicate
    if (existingAlerts.length > 0) {
      // Find the most recent one
      const mostRecent = existingAlerts.sort((a, b) => b.createdAt - a.createdAt)[0];

      // Only update if new severity is higher or equal
      const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };
      const newRank = severityRank[args.severity];
      const existingRank = severityRank[mostRecent.severity];

      if (newRank >= existingRank) {
        // Update existing alert with new info
        await ctx.db.patch(mostRecent._id, {
          severity: args.severity,
          title: args.title,
          description: args.description,
          evidence: args.evidence,
          updatedAt: now,
        });
      }

      // Return existing alert ID (no duplicate created)
      return mostRecent._id;
    }

    // No existing alert - create new one
    const alertId = await ctx.db.insert("alerts", {
      ...args,
      accountAddress: account.address,
      status: "new",
      createdAt: now,
      updatedAt: now,
    });

    // Update account flagged status
    await ctx.db.patch(args.accountId, { isFlagged: true });

    // Add to activity feed
    await ctx.db.insert("activityFeed", {
      type: "alert_created",
      payload: {
        alertId,
        severity: args.severity,
        title: args.title,
      },
      timestamp: now,
    });

    return alertId;
  },
});

// Update alert status
export const updateStatus = mutation({
  args: {
    id: v.id("alerts"),
    status: statusValidator,
  },
  returns: v.null(),
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, {
      status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Delete all alerts (internal only - admin operation)
export const deleteAll = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const alerts = await ctx.db.query("alerts").collect();
    for (const alert of alerts) {
      await ctx.db.delete(alert._id);
    }
    return { deleted: alerts.length };
  },
});

// Remove duplicate alerts (internal only - admin operation)
export const removeDuplicates = internalMutation({
  args: {},
  returns: v.object({ removed: v.number(), remaining: v.number() }),
  handler: async (ctx) => {
    const alerts = await ctx.db.query("alerts").collect();
    const seen = new Set<string>();
    let removed = 0;

    for (const alert of alerts) {
      const key = `${alert.accountId}-${alert.title}`;
      if (seen.has(key)) {
        await ctx.db.delete(alert._id);
        removed++;
      } else {
        seen.add(key);
      }
    }

    return { removed, remaining: alerts.length - removed };
  },
});
