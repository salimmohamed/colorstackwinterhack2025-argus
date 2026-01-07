import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all active markets, sorted by volume
export const listActive = query({
	args: {},
	handler: async (ctx) => {
		const markets = await ctx.db
			.query("markets")
			.withIndex("by_active", (q) => q.eq("isActive", true))
			.collect();
		// Sort by volume descending
		return markets.sort((a, b) => b.totalVolume - a.totalVolume);
	},
});

// Delete all markets (for cleanup)
export const deleteAll = mutation({
	args: {},
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
			.withIndex("by_polymarket_id", (q) => q.eq("polymarketId", args.polymarketId))
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
	},
});
