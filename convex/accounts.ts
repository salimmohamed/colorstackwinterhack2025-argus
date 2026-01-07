import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get account by wallet address
export const getByAddress = query({
	args: { address: v.string() },
	handler: async (ctx, { address }) => {
		return await ctx.db
			.query("accounts")
			.withIndex("by_address", (q) => q.eq("address", address.toLowerCase()))
			.first();
	},
});

// List flagged accounts
export const listFlagged = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query("accounts")
			.withIndex("by_flagged", (q) => q.eq("isFlagged", true))
			.collect();
	},
});

// List accounts by risk score (highest first)
export const listByRiskScore = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		const accounts = await ctx.db
			.query("accounts")
			.withIndex("by_risk_score")
			.order("desc")
			.take(limit ?? 50);
		return accounts;
	},
});

// Create or update account
export const upsert = mutation({
	args: {
		address: v.string(),
		displayName: v.optional(v.string()),
		previousNames: v.optional(v.array(v.string())),
		firstSeenAt: v.optional(v.number()),
		totalTrades: v.optional(v.number()),
		totalVolume: v.optional(v.number()),
		winCount: v.optional(v.number()),
		lossCount: v.optional(v.number()),
		winRate: v.optional(v.number()),
		riskScore: v.optional(v.number()),
		flags: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const normalizedAddress = args.address.toLowerCase();
		const existing = await ctx.db
			.query("accounts")
			.withIndex("by_address", (q) => q.eq("address", normalizedAddress))
			.first();

		const now = Date.now();

		if (existing) {
			// Track name changes
			let previousNames = existing.previousNames;
			if (
				args.displayName &&
				args.displayName !== existing.displayName &&
				existing.displayName
			) {
				previousNames = [...previousNames, existing.displayName];
			}

			await ctx.db.patch(existing._id, {
				displayName: args.displayName ?? existing.displayName,
				previousNames,
				totalTrades: args.totalTrades ?? existing.totalTrades,
				totalVolume: args.totalVolume ?? existing.totalVolume,
				winCount: args.winCount ?? existing.winCount,
				lossCount: args.lossCount ?? existing.lossCount,
				winRate: args.winRate ?? existing.winRate,
				riskScore: args.riskScore ?? existing.riskScore,
				flags: args.flags ?? existing.flags,
				lastActivityAt: now,
			});
			return existing._id;
		}

		return await ctx.db.insert("accounts", {
			address: normalizedAddress,
			displayName: args.displayName,
			previousNames: args.previousNames ?? [],
			firstSeenAt: args.firstSeenAt ?? now,
			createdAt: undefined,
			totalTrades: args.totalTrades ?? 0,
			totalVolume: args.totalVolume ?? 0,
			winCount: args.winCount ?? 0,
			lossCount: args.lossCount ?? 0,
			winRate: args.winRate ?? 0,
			riskScore: args.riskScore ?? 0,
			flags: args.flags ?? [],
			lastActivityAt: now,
			isFlagged: false,
		});
	},
});

// Flag an account as suspicious
export const flag = mutation({
	args: {
		address: v.string(),
		flags: v.array(v.string()),
		riskScore: v.number(),
	},
	handler: async (ctx, { address, flags, riskScore }) => {
		const account = await ctx.db
			.query("accounts")
			.withIndex("by_address", (q) => q.eq("address", address.toLowerCase()))
			.first();

		if (!account) {
			throw new Error(`Account not found: ${address}`);
		}

		await ctx.db.patch(account._id, {
			isFlagged: true,
			flags,
			riskScore,
		});

		return account._id;
	},
});
