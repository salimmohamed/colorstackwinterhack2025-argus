import { mutation } from "./_generated/server";

/**
 * Seed REAL insider trading cases as if detected by ARGUS
 * Based on documented Polymarket incidents
 */
export const seedInsiderCases = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// Clear existing data first
		const existingAccounts = await ctx.db.query("accounts").collect();
		for (const account of existingAccounts) {
			await ctx.db.delete(account._id);
		}
		const existingAlerts = await ctx.db.query("alerts").collect();
		for (const alert of existingAlerts) {
			await ctx.db.delete(alert._id);
		}
		const existingRuns = await ctx.db.query("agentRuns").collect();
		for (const run of existingRuns) {
			await ctx.db.delete(run._id);
		}

		// Create an agent run to make it look like ARGUS detected these
		const agentRun = await ctx.db.insert("agentRuns", {
			startedAt: now - 2 * 60 * 60 * 1000, // 2 hours ago
			completedAt: now - 2 * 60 * 60 * 1000 + 45000, // 45 seconds later
			status: "completed",
			triggerType: "scheduled",
			marketIds: [],
			accountsAnalyzed: 847,
			alertsGenerated: 2,
			toolCalls: [
				{
					tool: "fetch_market_activity",
					input: { marketId: "will-maduro-leave-office-before-feb" },
					output: { trades: 156, suspicious: 3 },
					timestamp: now - 2 * 60 * 60 * 1000 + 5000,
				},
				{
					tool: "fetch_account_data",
					input: { address: "0x31a56e9e690c621ed21de08cb559e9524cdb8ed9" },
					output: { age: 7, trades: 4, winRate: 1.0 },
					timestamp: now - 2 * 60 * 60 * 1000 + 12000,
				},
				{
					tool: "flag_suspicious_account",
					input: { address: "0x31a56e9e690c621ed21de08cb559e9524cdb8ed9", severity: "critical" },
					output: { success: true },
					timestamp: now - 2 * 60 * 60 * 1000 + 18000,
				},
				{
					tool: "fetch_market_activity",
					input: { marketId: "google-year-in-search-2025" },
					output: { trades: 892, suspicious: 1 },
					timestamp: now - 2 * 60 * 60 * 1000 + 25000,
				},
				{
					tool: "fetch_account_data",
					input: { address: "0xee50a31c3f5a7c77824b12a941a54388a2827ed6" },
					output: { age: 45, trades: 28, winRate: 0.92 },
					timestamp: now - 2 * 60 * 60 * 1000 + 32000,
				},
				{
					tool: "flag_suspicious_account",
					input: { address: "0xee50a31c3f5a7c77824b12a941a54388a2827ed6", severity: "critical" },
					output: { success: true },
					timestamp: now - 2 * 60 * 60 * 1000 + 40000,
				},
			],
			tokensUsed: {
				input: 12847,
				output: 3291,
			},
		});

		// ============ CASE 1: Maduro Insider (Burdensome-Mix) ============
		const maduroTrader = await ctx.db.insert("accounts", {
			address: "0x31a56e9e690c621ed21de08cb559e9524cdb8ed9",
			displayName: "Burdensome-Mix",
			previousNames: [],
			firstSeenAt: now - 16 * 24 * 60 * 60 * 1000,
			accountAgeDays: 7,
			totalTrades: 4,
			totalVolume: 32000,
			winCount: 2,
			lossCount: 0,
			winRate: 1.0,
			riskScore: 98,
			flags: ["FRESH_WALLET", "HIGH_WIN_RATE", "CONCENTRATED_BETS", "LARGE_PROFIT", "SUSPICIOUS_TIMING"],
			lastActivityAt: now - 9 * 24 * 60 * 60 * 1000,
			isFlagged: true,
			lastAnalyzedAt: now - 2 * 60 * 60 * 1000,
			cachedProfile: {
				profitLossUsd: 436759,
				avgTradeSize: 8000,
				uniqueMarkets: 1,
				cachedAt: now - 2 * 60 * 60 * 1000,
			},
		});

		await ctx.db.insert("alerts", {
			accountId: maduroTrader,
			accountAddress: "0x31a56e9e690c621ed21de08cb559e9524cdb8ed9",
			severity: "critical",
			signalType: "timing_correlation",
			title: "Fresh wallet, $32K bet 5hrs before Maduro capture",
			description:
				"7-day-old account bet $32K at 5.5% odds on Maduro leaving office. Bet placed 5 hours before US military operation. 100% win rate, $436K profit. Only trades on Venezuela markets.",
			evidence: {
				metrics: {
					riskScore: 98,
					totalProfit: 436759,
					totalVolume: 32000,
					winRate: 1.0,
					accountAgeDays: 7,
					totalTrades: 4,
				},
				reasoning:
					"Account is only 7 days old, placed a $32K bet at 5.5% odds just hours before a classified military operation, and has 100% win rate on Venezuela markets. This is textbook insider behavior.",
			},
			status: "investigating",
			createdAt: now - 2 * 60 * 60 * 1000,
			updatedAt: now,
			agentRunId: agentRun,
		});

		// ============ CASE 2: Google Insider (AlphaRaccoon / 0xafEe) ============
		const googleTrader = await ctx.db.insert("accounts", {
			address: "0xee50a31c3f5a7c77824b12a941a54388a2827ed6",
			displayName: "0xafEe",
			previousNames: ["AlphaRaccoon"],
			firstSeenAt: now - 60 * 24 * 60 * 60 * 1000,
			accountAgeDays: 45,
			totalTrades: 28,
			totalVolume: 3000000,
			winCount: 24,
			lossCount: 2,
			winRate: 0.92,
			riskScore: 95,
			flags: ["HIGH_WIN_RATE", "CONCENTRATED_BETS", "LARGE_PROFIT", "SUSPICIOUS_TIMING", "STATISTICAL_IMPROBABILITY"],
			lastActivityAt: now - 14 * 24 * 60 * 60 * 1000,
			isFlagged: true,
			lastAnalyzedAt: now - 2 * 60 * 60 * 1000,
			cachedProfile: {
				profitLossUsd: 1300000,
				avgTradeSize: 107142,
				uniqueMarkets: 4,
				cachedAt: now - 2 * 60 * 60 * 1000,
			},
		});

		await ctx.db.insert("alerts", {
			accountId: googleTrader,
			accountAddress: "0xee50a31c3f5a7c77824b12a941a54388a2827ed6",
			severity: "critical",
			signalType: "statistical_improbability",
			title: "22/23 correct Google Search predictions, $1.3M profit",
			description:
				"95.6% win rate on Google Year in Search markets. Deposited $3M, bet right before Google accidentally published data early. Also predicted exact Gemini 3.0 release for $150K profit.",
			evidence: {
				metrics: {
					riskScore: 95,
					totalProfit: 1300000,
					totalVolume: 3000000,
					winRate: 0.956,
					accountAgeDays: 45,
					totalTrades: 28,
				},
				reasoning:
					"22/23 wins has <0.001% probability by chance. Timing matches Google's accidental early data publish. Previously nailed Gemini 3.0 launch date.",
			},
			status: "new",
			createdAt: now - 2 * 60 * 60 * 1000 + 22000,
			updatedAt: now - 14 * 24 * 60 * 60 * 1000,
			agentRunId: agentRun,
		});

		// Add activity feed entries to show ARGUS activity
		await ctx.db.insert("activityFeed", {
			type: "agent_started",
			payload: { runId: agentRun, triggerType: "scheduled" },
			timestamp: now - 2 * 60 * 60 * 1000,
		});

		await ctx.db.insert("activityFeed", {
			type: "alert_created",
			payload: {
				severity: "critical",
				accountAddress: "0x31a56e9e690c621ed21de08cb559e9524cdb8ed9",
				title: "Fresh wallet with $32K bet placed hours before Maduro capture",
			},
			timestamp: now - 2 * 60 * 60 * 1000 + 18000,
		});

		await ctx.db.insert("activityFeed", {
			type: "alert_created",
			payload: {
				severity: "critical",
				accountAddress: "0xee50a31c3f5a7c77824b12a941a54388a2827ed6",
				title: "22/23 correct predictions on Google Search outcomes",
			},
			timestamp: now - 2 * 60 * 60 * 1000 + 40000,
		});

		await ctx.db.insert("activityFeed", {
			type: "agent_completed",
			payload: {
				runId: agentRun,
				accountsAnalyzed: 847,
				alertsGenerated: 2,
				duration: 45000,
			},
			timestamp: now - 2 * 60 * 60 * 1000 + 45000,
		});

		return {
			success: true,
			seeded: {
				accounts: 2,
				alerts: 2,
				agentRuns: 1,
				activityFeed: 4,
			},
			cases: [
				{
					name: "Maduro Capture Insider (Burdensome-Mix)",
					wallet: "0x31a56e9e690c621ed21de08cb559e9524cdb8ed9",
					profit: "$436,759",
					detectedBy: "ARGUS timing_correlation analysis",
				},
				{
					name: "Google Search Insider (0xafEe)",
					wallet: "0xee50a31c3f5a7c77824b12a941a54388a2827ed6",
					profit: "$1.3M+",
					detectedBy: "ARGUS statistical_improbability analysis",
				},
			],
		};
	},
});
