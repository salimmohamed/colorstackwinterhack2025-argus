import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// Get recent activity feed items
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
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
  },
});
