import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// List recent agent runs
export const listRecent = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		return await ctx.db
			.query("agentRuns")
			.withIndex("by_started")
			.order("desc")
			.take(limit ?? 20);
	},
});

// Get a single agent run
export const get = query({
	args: { id: v.id("agentRuns") },
	handler: async (ctx, { id }) => {
		return await ctx.db.get(id);
	},
});

// Start a new agent run
export const start = mutation({
	args: {
		triggerType: v.union(
			v.literal("scheduled"),
			v.literal("manual"),
			v.literal("realtime_trigger"),
		),
		marketIds: v.array(v.id("markets")),
	},
	handler: async (ctx, { triggerType, marketIds }) => {
		const now = Date.now();

		const runId = await ctx.db.insert("agentRuns", {
			startedAt: now,
			completedAt: undefined,
			status: "running",
			triggerType,
			marketIds,
			accountsAnalyzed: 0,
			alertsGenerated: 0,
			toolCalls: [],
			tokensUsed: { input: 0, output: 0 },
			error: undefined,
		});

		// Add to activity feed
		await ctx.db.insert("activityFeed", {
			type: "agent_started",
			payload: { runId, triggerType },
			timestamp: now,
		});

		return runId;
	},
});

// Update agent run progress
export const updateProgress = mutation({
	args: {
		runId: v.id("agentRuns"),
		accountsAnalyzed: v.optional(v.number()),
		alertsGenerated: v.optional(v.number()),
		toolCalls: v.optional(
			v.array(
				v.object({
					tool: v.string(),
					input: v.any(),
					output: v.any(),
					timestamp: v.number(),
				}),
			),
		),
		tokensUsed: v.optional(
			v.object({
				input: v.number(),
				output: v.number(),
			}),
		),
	},
	handler: async (ctx, { runId, ...updates }) => {
		const run = await ctx.db.get(runId);
		if (!run) throw new Error(`Agent run not found: ${runId}`);

		await ctx.db.patch(runId, {
			accountsAnalyzed: updates.accountsAnalyzed ?? run.accountsAnalyzed,
			alertsGenerated: updates.alertsGenerated ?? run.alertsGenerated,
			toolCalls: updates.toolCalls ?? run.toolCalls,
			tokensUsed: updates.tokensUsed ?? run.tokensUsed,
		});
	},
});

// Complete an agent run
export const complete = mutation({
	args: {
		runId: v.id("agentRuns"),
		accountsAnalyzed: v.number(),
		alertsGenerated: v.number(),
		toolCalls: v.array(
			v.object({
				tool: v.string(),
				input: v.any(),
				output: v.any(),
				timestamp: v.number(),
			}),
		),
		tokensUsed: v.object({
			input: v.number(),
			output: v.number(),
		}),
	},
	handler: async (ctx, { runId, ...updates }) => {
		const now = Date.now();

		await ctx.db.patch(runId, {
			...updates,
			status: "completed",
			completedAt: now,
		});

		// Add to activity feed
		await ctx.db.insert("activityFeed", {
			type: "agent_completed",
			payload: {
				runId,
				accountsAnalyzed: updates.accountsAnalyzed,
				alertsGenerated: updates.alertsGenerated,
			},
			timestamp: now,
		});
	},
});

// Fail an agent run
export const fail = mutation({
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

// Trigger a scheduled monitoring run (called by cron)
export const triggerScheduledRun = internalMutation({
	args: {},
	handler: async (ctx) => {
		// Get all active markets to monitor
		const activeMarkets = await ctx.db
			.query("markets")
			.withIndex("by_active", (q) => q.eq("isActive", true))
			.collect();

		if (activeMarkets.length === 0) {
			console.log("[Cron] No active markets to monitor");
			return;
		}

		const marketIds = activeMarkets.map((m) => m._id);
		const now = Date.now();

		// Create a new agent run
		const runId = await ctx.db.insert("agentRuns", {
			startedAt: now,
			completedAt: undefined,
			status: "running",
			triggerType: "scheduled",
			marketIds,
			accountsAnalyzed: 0,
			alertsGenerated: 0,
			toolCalls: [],
			tokensUsed: { input: 0, output: 0 },
			error: undefined,
		});

		// Add to activity feed
		await ctx.db.insert("activityFeed", {
			type: "agent_started",
			payload: { runId, triggerType: "scheduled" },
			timestamp: now,
		});

		console.log(
			`[Cron] Started scheduled monitoring run ${runId} for ${marketIds.length} markets`,
		);

		// Note: In production, this would trigger the actual agent via an HTTP action
		// For now, we just log that monitoring was triggered
	},
});
