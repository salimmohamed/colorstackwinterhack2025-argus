/**
 * Tool executor - implements the actual functionality for each tool
 * Software 3.0 approach: tools provide raw data, AI makes judgments
 */

import { dataApiClient } from "../polymarket/data-api";
import type { Position } from "../polymarket/data-api";
import { gammaClient } from "../polymarket/gamma";
import { subgraphClient } from "../polymarket/subgraph";
import type { AccountData, AlertEvidence, MarketActivityData, MarketHoldersData, WalletPositionsData, MarketComparisonData } from "./types";

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

	// Get positions
	const positions = await dataApiClient.getUserPositions(address) as Position[];

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

	// Calculate win rate from resolved positions
	const closedPositions = positions.filter((p: Position) => p.realizedPnl !== 0);
	const wins = closedPositions.filter((p: Position) => p.realizedPnl > 0).length;
	const winRate = closedPositions.length >= 2 ? wins / closedPositions.length : 0;

	// Calculate profits
	const realizedProfit = positions.reduce((sum: number, p: Position) => sum + (p.realizedPnl || 0), 0);
	const unrealizedProfit = positions.reduce((sum: number, p: Position) => sum + (p.cashPnl || 0), 0);
	const totalProfit = realizedProfit + unrealizedProfit;

	// Get market categories
	const categories = new Set<string>();
	for (const trade of trades) {
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
		resolvedPositions: closedPositions.length,
		wins,
		losses: closedPositions.length - wins,
		winRate,
		profitLossUsd: totalProfit,
		realizedProfit,
		unrealizedProfit,
		marketCategories: [...categories],
		politicalMarketExposure,
		recentTrades,
		positions: positions.map((p: Position) => ({
			market: p.title || p.slug,
			outcome: p.outcomeIndex === 0 ? "Yes" : "No",
			size: p.size,
			currentValue: p.currentValue,
			initialValue: p.initialValue,
			realizedPnl: p.realizedPnl,
			unrealizedPnl: p.cashPnl,
		})),
		tradesNearEventResolution: [],
	};
}

/**
 * Fetch market activity with context
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
		amount: a.usdcSize || (a.size * a.price),
		price: a.price,
	}));

	// Calculate stats
	const totalVolume = trades.reduce((sum, t) => sum + t.amount, 0);
	const uniqueTraders = new Set(trades.map((t) => t.traderAddress)).size;
	const largeTradeCount = trades.filter((t) => t.amount >= 5000).length;
	const averageTradeSize = trades.length > 0 ? totalVolume / trades.length : 0;

	// Find top traders by volume
	const traderVolumes = new Map<string, number>();
	for (const trade of trades) {
		const current = traderVolumes.get(trade.traderAddress) || 0;
		traderVolumes.set(trade.traderAddress, current + trade.amount);
	}
	const topTraders = [...traderVolumes.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([address, volume]) => ({ address, volume }));

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
		topTraders,
	};
}

/**
 * Fetch market holders (position distribution)
 */
export async function fetchMarketHolders(
	marketId: string,
): Promise<MarketHoldersData> {
	const holdersResponse = await dataApiClient.getMarketHolders(marketId);

	// Process holders
	const allHolders: Array<{ address: string; amount: number; outcome: string }> = [];
	let totalValue = 0;

	for (const response of holdersResponse) {
		for (const holder of response.holders) {
			allHolders.push({
				address: holder.proxyWallet,
				amount: holder.amount,
				outcome: response.outcome,
			});
			totalValue += holder.amount;
		}
	}

	// Calculate concentration
	const holderTotals = new Map<string, number>();
	for (const holder of allHolders) {
		const current = holderTotals.get(holder.address.toLowerCase()) || 0;
		holderTotals.set(holder.address.toLowerCase(), current + holder.amount);
	}

	// Sort by holding size
	const sortedHolders = [...holderTotals.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([address, amount]) => ({
			address,
			amount,
			percentOfMarket: totalValue > 0 ? amount / totalValue : 0,
		}));

	// Top holder concentration
	const top5Concentration = sortedHolders
		.slice(0, 5)
		.reduce((sum, h) => sum + h.percentOfMarket, 0);

	return {
		marketId,
		totalHolders: holderTotals.size,
		totalValue,
		holders: sortedHolders.slice(0, 50), // Top 50
		top5Concentration,
		largestHolderPercent: sortedHolders[0]?.percentOfMarket || 0,
	};
}

/**
 * Fetch wallet positions
 */
export async function fetchWalletPositions(
	address: string,
): Promise<WalletPositionsData> {
	const positions = await dataApiClient.getUserPositions(address) as Position[];

	const totalValue = positions.reduce((sum: number, p: Position) => sum + (p.currentValue || 0), 0);
	const totalRealizedPnl = positions.reduce((sum: number, p: Position) => sum + (p.realizedPnl || 0), 0);
	const totalUnrealizedPnl = positions.reduce((sum: number, p: Position) => sum + (p.cashPnl || 0), 0);

	// Unique markets
	const uniqueMarkets = new Set(positions.map((p: Position) => p.conditionId));

	// Largest position
	const largestPosition = positions.reduce(
		(max: Position | null, p: Position) => (!max || (p.currentValue || 0) > (max.currentValue || 0) ? p : max),
		null as Position | null,
	);

	return {
		address: address.toLowerCase(),
		totalPositions: positions.length,
		totalValue,
		totalRealizedPnl,
		totalUnrealizedPnl,
		uniqueMarkets: uniqueMarkets.size,
		positions: positions.map((p: Position) => ({
			market: p.title || p.slug,
			conditionId: p.conditionId,
			outcome: p.outcomeIndex === 0 ? "Yes" : "No",
			size: p.size,
			currentValue: p.currentValue,
			initialValue: p.initialValue,
			realizedPnl: p.realizedPnl,
			unrealizedPnl: p.cashPnl,
			percentChange: p.percentChange,
		})),
		largestPosition: largestPosition
			? {
					market: largestPosition.title || largestPosition.slug,
					value: largestPosition.currentValue,
					pnl: (largestPosition.realizedPnl || 0) + (largestPosition.cashPnl || 0),
				}
			: null,
	};
}

/**
 * Compare trader to market context
 */
export async function compareToMarket(
	address: string,
	marketId: string,
): Promise<MarketComparisonData> {
	// Get market activity for context
	const marketActivity = await fetchMarketActivity(marketId, 168); // 7 days
	const holders = await fetchMarketHolders(marketId);

	// Get trader's activity in this market
	const accountActivity = await dataApiClient.getAccountActivity(address, 500);
	const marketTrades = accountActivity.filter(
		(a) => a.conditionId === marketId && a.type === "TRADE",
	);

	// Calculate relative metrics
	const traderVolume = marketTrades.reduce((sum, t) => sum + t.usdcSize, 0);
	const traderLargestTrade = Math.max(...marketTrades.map((t) => t.usdcSize), 0);

	// Relative to market average
	const relativeBetSize =
		marketActivity.averageTradeSize > 0
			? traderLargestTrade / marketActivity.averageTradeSize
			: 0;

	// Position in holder rankings
	const normalizedAddress = address.toLowerCase();
	const holderPosition = holders.holders.findIndex(
		(h) => h.address.toLowerCase() === normalizedAddress,
	);
	const marketDominance =
		holders.holders.find((h) => h.address.toLowerCase() === normalizedAddress)
			?.percentOfMarket || 0;

	// Volume percentile
	const traderRank = marketActivity.topTraders?.findIndex(
		(t) => t.address.toLowerCase() === normalizedAddress,
	);
	const volumePercentile =
		traderRank !== undefined && traderRank >= 0
			? 1 - traderRank / (marketActivity.topTraders?.length || 1)
			: 0;

	return {
		address: normalizedAddress,
		marketId,
		marketQuestion: marketActivity.question,
		// Relative metrics
		relativeBetSize,
		marketDominance,
		volumePercentile,
		holderRank: holderPosition >= 0 ? holderPosition + 1 : null,
		// Absolute context
		traderVolume,
		traderLargestTrade,
		marketAverageTradeSize: marketActivity.averageTradeSize,
		marketTotalVolume: marketActivity.totalVolume,
		totalMarketTraders: marketActivity.uniqueTraders,
		// Interpretation helpers
		isWhale: relativeBetSize >= 5,
		isDominant: marketDominance >= 0.3,
		isTopTrader: volumePercentile >= 0.9,
	};
}

/**
 * Flag a suspicious account - saves to Convex
 */
export async function flagSuspiciousAccount(params: {
	address: string;
	marketId?: string;
	severity: "low" | "medium" | "high" | "critical";
	signalType: string;
	title: string;
	reasoning: string;
	evidence?: AlertEvidence;
}): Promise<{ success: boolean; alertId: string; message: string }> {
	// In a real implementation with Convex client, this would:
	// 1. Upsert the account record
	// 2. Create the alert
	// 3. Update activity feed

	// For now, log the flag and return success
	// The actual Convex mutations would be called from the API route
	// that has access to the Convex client

	console.log("[Agent] FLAGGING ACCOUNT:", {
		address: params.address,
		severity: params.severity,
		signalType: params.signalType,
		title: params.title,
		reasoning: params.reasoning.slice(0, 200) + "...",
		evidence: params.evidence,
	});

	// Return the flag data for the API to save
	return {
		success: true,
		alertId: `pending_${Date.now()}`,
		message: `Account ${params.address} flagged as ${params.severity} severity. Reasoning: ${params.title}`,
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

		case "fetch_market_holders":
			return fetchMarketHolders(input.marketId as string);

		case "fetch_wallet_positions":
			return fetchWalletPositions(input.address as string);

		case "compare_to_market":
			return compareToMarket(
				input.address as string,
				input.marketId as string,
			);

		case "flag_suspicious_account":
			return flagSuspiciousAccount({
				address: input.address as string,
				marketId: input.marketId as string | undefined,
				severity: input.severity as "low" | "medium" | "high" | "critical",
				signalType: input.signalType as string,
				title: input.title as string,
				reasoning: input.reasoning as string,
				evidence: input.evidence as AlertEvidence | undefined,
			});

		default:
			throw new Error(`Unknown tool: ${toolName}`);
	}
}
