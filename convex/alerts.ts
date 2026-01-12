import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List recent alerts
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
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
  args: {
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),
  },
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
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Create a new alert
export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    marketId: v.optional(v.id("markets")),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),
    signalType: v.union(
      v.literal("new_account_large_bet"),
      v.literal("timing_correlation"),
      v.literal("statistical_improbability"),
      v.literal("account_obfuscation"),
      v.literal("disproportionate_bet"),
      v.literal("pattern_match"),
    ),
    title: v.string(),
    description: v.string(),
    evidence: v.object({
      metrics: v.any(),
      reasoning: v.string(),
    }),
    agentRunId: v.optional(v.id("agentRuns")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get account address for denormalized display
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error(`Account not found: ${args.accountId}`);

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
    status: v.union(
      v.literal("new"),
      v.literal("investigating"),
      v.literal("confirmed"),
      v.literal("dismissed"),
    ),
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, {
      status,
      updatedAt: Date.now(),
    });
  },
});

// Delete all alerts
export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const alerts = await ctx.db.query("alerts").collect();
    for (const alert of alerts) {
      await ctx.db.delete(alert._id);
    }
    return { deleted: alerts.length };
  },
});
