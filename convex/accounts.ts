import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

// Account validator for return types
const accountValidator = v.object({
  _id: v.id("accounts"),
  _creationTime: v.number(),
  address: v.string(),
  displayName: v.optional(v.string()),
  previousNames: v.array(v.string()),
  firstSeenAt: v.number(),
  createdAt: v.optional(v.number()),
  accountAgeDays: v.optional(v.number()),
  totalTrades: v.number(),
  totalVolume: v.number(),
  winCount: v.number(),
  lossCount: v.number(),
  winRate: v.number(),
  riskScore: v.number(),
  flags: v.array(v.string()),
  lastActivityAt: v.number(),
  isFlagged: v.boolean(),
  lastAnalyzedAt: v.optional(v.number()),
  cachedProfile: v.optional(
    v.object({
      profitLossUsd: v.number(),
      avgTradeSize: v.number(),
      uniqueMarkets: v.number(),
      cachedAt: v.number(),
    })
  ),
  analysisStatus: v.optional(
    v.union(v.literal("pending"), v.literal("cleared"), v.literal("confirmed"))
  ),
});

// Get account by wallet address
export const getByAddress = query({
  args: { address: v.string() },
  returns: v.union(accountValidator, v.null()),
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
  returns: v.array(accountValidator),
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
  returns: v.array(accountValidator),
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
  returns: v.id("accounts"),
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
      createdAt: now,
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
  returns: v.id("accounts"),
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

// List all accounts
export const listAll = query({
  args: {},
  returns: v.array(accountValidator),
  handler: async (ctx) => {
    return await ctx.db.query("accounts").collect();
  },
});

// Delete all accounts (internal only - admin operation)
export const deleteAll = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();
    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }
    return { deleted: accounts.length };
  },
});

// Remove duplicate accounts (internal only - admin operation)
export const removeDuplicates = internalMutation({
  args: {},
  returns: v.object({ removed: v.number(), remaining: v.number() }),
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();
    const seenAddresses = new Set<string>();
    let removed = 0;

    for (const account of accounts) {
      const addr = account.address.toLowerCase();
      if (seenAddresses.has(addr)) {
        await ctx.db.delete(account._id);
        removed++;
      } else {
        seenAddresses.add(addr);
      }
    }

    return { removed, remaining: accounts.length - removed };
  },
});

// Delete account by address (internal only - admin operation)
export const deleteByAddress = internalMutation({
  args: { address: v.string() },
  returns: v.union(
    v.object({ deleted: v.literal(false), message: v.string() }),
    v.object({
      deleted: v.literal(true),
      accountId: v.id("accounts"),
      alertsDeleted: v.number(),
    })
  ),
  handler: async (ctx, { address }) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_address", (q) => q.eq("address", address.toLowerCase()))
      .first();

    if (!account) {
      return { deleted: false as const, message: "Account not found" };
    }

    // Delete associated alerts
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .collect();

    for (const alert of alerts) {
      await ctx.db.delete(alert._id);
    }

    // Delete the account
    await ctx.db.delete(account._id);

    return {
      deleted: true as const,
      accountId: account._id,
      alertsDeleted: alerts.length,
    };
  },
});
