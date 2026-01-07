/**
 * Tool executor - implements the actual functionality for each tool
 */

import { dataApiClient, gammaClient, subgraphClient } from "../polymarket";
import type { AccountData, AlertEvidence, MarketActivityData } from "./types";

/**
 * Check if a string looks like an obfuscated name (random characters)
 */
function isObfuscatedName(name: string | null | undefined): boolean {
	if (!name) return false;

	// Check for patterns like random hex strings or UUIDs
	const hexPattern = /^[0-9a-f]{8,}$/i;
	const randomPattern = /^[a-z0-9]{20,}$/i;
	const uuidPattern =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	return (
		hexPattern.test(name) || randomPattern.test(name) || uuidPattern.test(name)
	);
}

/**
 * Fetch comprehensive account data
 */
export async function fetchAccountData(address: string): Promise<AccountData> {
	// Get activity from Data API
	const activity = await dataApiClient.getAccountActivity(address);
	const trades = activity.filter((a) => a.type === "TRADE");

	// Get account age from subgraph
	const accountAgeDays = await subgraphClient.getAccountAgeDays(address);
	const firstTrade = await subgraphClient.getAccountFirstTrade(address);

	// Calculate statistics
	const stats = dataApiClient.calculateAccountStats(activity);

	// Track display names
	const displayNames = new Set<string>();
	for (const trade of trades) {
		if (trade.name) displayNames.add(trade.name);
		if (trade.pseudonym) displayNames.add(trade.pseudonym);
	}
	const uniqueNames = [...displayNames].filter(Boolean);

	// Get current name (most recent)
	const currentDisplayName = trades[0]?.name || trades[0]?.pseudonym || null;

	// Previous names (excluding current)
	const previousDisplayNames = uniqueNames.filter(
		(n) => n !== currentDisplayName,
	);

	// Find largest trade
	let largestTrade: AccountData["largestTrade"] = null;
	if (trades.length > 0) {
		const largest = trades.reduce((max, t) =>
			t.usdcSize > (max?.usdcSize || 0) ? t : max,
		);
		largestTrade = {
			amount: largest.usdcSize,
			marketSlug: largest.slug,
			timestamp: largest.timestamp,
		};
	}

	// Calculate win rate (simplified - based on resolved positions)
	// In a real implementation, you'd check which positions resolved profitably
	const wins = 0; // Would need market resolution data
	const losses = 0;
	const resolvedPositions = 0;

	// Get market categories
	const categories = new Set<string>();
	for (const trade of trades) {
		// Extract category from title/slug if available
		if (trade.title?.toLowerCase().includes("president")) categories.add("politics");
		if (trade.title?.toLowerCase().includes("election")) categories.add("politics");
		if (trade.title?.toLowerCase().includes("trump")) categories.add("politics");
		if (trade.title?.toLowerCase().includes("biden")) categories.add("politics");
	}

	// Calculate political market exposure
	const politicalTrades = trades.filter(
		(t) =>
			t.title?.toLowerCase().includes("president") ||
			t.title?.toLowerCase().includes("election") ||
			t.title?.toLowerCase().includes("trump") ||
			t.title?.toLowerCase().includes("biden") ||
			t.title?.toLowerCase().includes("political"),
	);
	const politicalMarketExposure =
		trades.length > 0 ? politicalTrades.length / trades.length : 0;

	// Recent trades (last 50)
	const recentTrades = trades.slice(0, 50).map((t) => ({
		timestamp: t.timestamp,
		marketSlug: t.slug,
		outcome: t.outcome,
		side: t.side,
		amount: t.usdcSize,
		price: t.price,
	}));

	// Trades near event resolution (would need market end dates)
	const tradesNearEventResolution: AccountData["tradesNearEventResolution"] =
		[];

	return {
		address: address.toLowerCase(),
		currentDisplayName,
		previousDisplayNames,
		nameChangeCount: previousDisplayNames.length,
		hasObfuscatedName: isObfuscatedName(currentDisplayName),
		firstActivityTimestamp: firstTrade?.timestamp || null,
		accountAgeDays,
		totalTrades: stats.totalTrades,
		totalVolumeUsd: stats.totalVolume,
		averageTradeSize: stats.averageTradeSize,
		largestTrade,
		resolvedPositions,
		wins,
		losses,
		winRate: resolvedPositions > 0 ? wins / resolvedPositions : 0,
		profitLossUsd: 0, // Would need resolution data
		marketCategories: [...categories],
		politicalMarketExposure,
		recentTrades,
		tradesNearEventResolution,
	};
}

/**
 * Fetch market activity
 */
export async function fetchMarketActivity(
	marketId: string,
	hoursBack = 72,
	minTradeSize?: number,
): Promise<MarketActivityData> {
	// Try to get market details
	let market = await gammaClient.getMarketById(marketId);
	if (!market) {
		market = await gammaClient.getMarketBySlug(marketId);
	}

	// Get activity
	const activity = await dataApiClient.getMarketActivity(
		marketId,
		hoursBack,
		minTradeSize,
	);

	// Process trades
	const trades = activity.map((a) => ({
		traderAddress: a.proxyWallet,
		traderName: a.name || a.pseudonym || null,
		timestamp: a.timestamp,
		side: a.side,
		outcome: a.outcome,
		amount: a.usdcSize,
		price: a.price,
	}));

	// Calculate stats
	const totalVolume = trades.reduce((sum, t) => sum + t.amount, 0);
	const uniqueTraders = new Set(trades.map((t) => t.traderAddress)).size;
	const largeTradeCount = trades.filter((t) => t.amount >= 5000).length;
	const averageTradeSize = trades.length > 0 ? totalVolume / trades.length : 0;

	return {
		marketId,
		marketSlug: market?.slug || marketId,
		question: market?.question || "Unknown market",
		endDate: market?.endDate ? new Date(market.endDate).getTime() : null,
		trades,
		totalVolume,
		uniqueTraders,
		largeTradeCount,
		averageTradeSize,
	};
}

/**
 * Flag a suspicious account (stub - in real implementation, this saves to Convex)
 */
export async function flagSuspiciousAccount(params: {
	address: string;
	marketId?: string;
	severity: "low" | "medium" | "high" | "critical";
	title: string;
	reasoning: string;
	evidence?: AlertEvidence;
}): Promise<{ success: boolean; alertId: string }> {
	// In a real implementation, this would:
	// 1. Look up the account in Convex
	// 2. Create an alert record
	// 3. Update the account's flagged status
	// 4. Add to activity feed

	console.log("FLAGGING ACCOUNT:", {
		address: params.address,
		severity: params.severity,
		title: params.title,
		reasoning: params.reasoning,
		evidence: params.evidence,
	});

	// Return mock result
	return {
		success: true,
		alertId: `alert_${Date.now()}`,
	};
}

/**
 * Execute a tool call
 */
export async function executeTool(
	toolName: string,
	input: Record<string, unknown>,
): Promise<unknown> {
	switch (toolName) {
		case "fetch_account_data":
			return fetchAccountData(input.address as string);

		case "fetch_market_activity":
			return fetchMarketActivity(
				input.marketId as string,
				(input.hoursBack as number) || 72,
				input.minTradeSize as number | undefined,
			);

		case "flag_suspicious_account":
			return flagSuspiciousAccount({
				address: input.address as string,
				marketId: input.marketId as string | undefined,
				severity: input.severity as "low" | "medium" | "high" | "critical",
				title: input.title as string,
				reasoning: input.reasoning as string,
				evidence: input.evidence as AlertEvidence | undefined,
			});

		default:
			throw new Error(`Unknown tool: ${toolName}`);
	}
}
