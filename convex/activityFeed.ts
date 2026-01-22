import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// Activity type validator
const activityTypeValidator = v.union(
  v.literal("trade_detected"),
  v.literal("alert_created"),
  v.literal("agent_started"),
  v.literal("agent_completed"),
  v.literal("market_synced"),
  v.literal("detection_completed")
);

// Typed payload based on activity type
const activityPayloadValidator = v.object({
  // alert_created
  alertId: v.optional(v.id("alerts")),
  severity: v.optional(v.string()),
  title: v.optional(v.string()),
  accountAddress: v.optional(v.string()),
  // agent_started / agent_completed
  runId: v.optional(v.id("agentRuns")),
  triggerType: v.optional(v.string()),
  accountsAnalyzed: v.optional(v.number()),
  alertsGenerated: v.optional(v.number()),
  duration: v.optional(v.number()),
  // market_synced
  marketsUpdated: v.optional(v.number()),
  // detection_completed
  mode: v.optional(v.string()),
  suspectsFound: v.optional(v.number()),
});

// Activity feed validator for return types
const activityFeedValidator = v.object({
  _id: v.id("activityFeed"),
  _creationTime: v.number(),
  type: activityTypeValidator,
  payload: activityPayloadValidator,
  timestamp: v.number(),
});

// Get recent activity feed items
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(activityFeedValidator),
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("activityFeed")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit ?? 50);
  },
});

// Clean up old activity feed entries (called by daily cron)
export const cleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Keep last 7 days of activity
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const oldEntries = await ctx.db
      .query("activityFeed")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoffTime))
      .collect();

    let deletedCount = 0;
    for (const entry of oldEntries) {
      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    console.log(`[Cron] Cleaned up ${deletedCount} old activity feed entries`);
    return null;
  },
});
