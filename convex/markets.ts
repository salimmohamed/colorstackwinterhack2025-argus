import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

// Outcome validator
const outcomeValidator = v.object({
  name: v.string(),
  tokenId: v.string(),
  price: v.number(),
});

// Market validator for return types
const marketValidator = v.object({
  _id: v.id("markets"),
  _creationTime: v.number(),
  polymarketId: v.string(),
  slug: v.string(),
  question: v.string(),
  category: v.string(),
  endDate: v.optional(v.number()),
  isActive: v.boolean(),
  totalVolume: v.number(),
  outcomes: v.array(outcomeValidator),
  lastSyncedAt: v.number(),
  lastAnalyzedAt: v.optional(v.number()),
  lastAnalyzedTradeTimestamp: v.optional(v.number()),
  cachedContext: v.optional(
    v.object({
      avgTradeSize: v.number(),
      totalVolume: v.number(),
      totalHolders: v.number(),
      cachedAt: v.number(),
    })
  ),
});

// Get all active markets, sorted by volume
export const listActive = query({
  args: {},
  returns: v.array(marketValidator),
  handler: async (ctx) => {
    const markets = await ctx.db
      .query("markets")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    // Sort by volume descending
    return markets.sort((a, b) => b.totalVolume - a.totalVolume);
  },
});

// Delete all markets (admin operation)
// TODO: Add authentication check when auth is implemented
export const deleteAll = mutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const markets = await ctx.db.query("markets").collect();
    for (const market of markets) {
      await ctx.db.delete(market._id);
    }
    return { deleted: markets.length };
  },
});

// Get markets by category
export const listByCategory = query({
  args: { category: v.string() },
  returns: v.array(marketValidator),
  handler: async (ctx, { category }) => {
    return await ctx.db
      .query("markets")
      .withIndex("by_category", (q) => q.eq("category", category))
      .collect();
  },
});

// Get a single market by Polymarket ID
export const getByPolymarketId = query({
  args: { polymarketId: v.string() },
  returns: v.union(marketValidator, v.null()),
  handler: async (ctx, { polymarketId }) => {
    return await ctx.db
      .query("markets")
      .withIndex("by_polymarket_id", (q) => q.eq("polymarketId", polymarketId))
      .first();
  },
});

// Add or update a market
export const upsert = mutation({
  args: {
    polymarketId: v.string(),
    slug: v.string(),
    question: v.string(),
    category: v.string(),
    endDate: v.optional(v.number()),
    isActive: v.boolean(),
    totalVolume: v.number(),
    outcomes: v.array(outcomeValidator),
  },
  returns: v.id("markets"),
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

// Internal mutation for scheduled sync (called by cron)
export const syncFromPolymarket = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // In production, this would fetch from Polymarket API
    // For now, just log that sync was triggered
    console.log("[Cron] Market sync triggered at", new Date().toISOString());

    // Add to activity feed
    await ctx.db.insert("activityFeed", {
      type: "market_synced",
      payload: { marketsUpdated: 0 },
      timestamp: Date.now(),
    });
    return null;
  },
});
