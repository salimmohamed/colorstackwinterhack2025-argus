/**
 * Agent type definitions
 */

// Tool definition for Claude
export interface Tool {
	name: string;
	description: string;
	input_schema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

// Tool call from Claude's response
export interface ToolUse {
	type: "tool_use";
	id: string;
	name: string;
	input: Record<string, unknown>;
}

// Tool result to send back
export interface ToolResult {
	type: "tool_result";
	tool_use_id: string;
	content: string;
	is_error?: boolean;
}

// Message content block
export type ContentBlock =
	| { type: "text"; text: string }
	| ToolUse
	| ToolResult;

// Message in conversation
export interface Message {
	role: "user" | "assistant";
	content: ContentBlock[] | string;
}

// Claude API response
export interface ClaudeResponse {
	id: string;
	type: "message";
	role: "assistant";
	content: ContentBlock[];
	model: string;
	stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
}

// Comprehensive account data for AI analysis
export interface AccountData {
	// Identity
	address: string;
	currentDisplayName: string | null;
	previousDisplayNames: string[];
	nameChangeCount: number;
	hasObfuscatedName: boolean;

	// Account Age
	firstActivityTimestamp: number | null;
	accountAgeDays: number | null;

	// Trading History
	totalTrades: number;
	totalVolumeUsd: number;
	averageTradeSize: number;
	largestTrade: {
		amount: number;
		marketSlug: string;
		timestamp: number;
	} | null;

	// Win/Loss Record
	resolvedPositions: number;
	wins: number;
	losses: number;
	winRate: number;
	profitLossUsd: number;

	// Market Focus
	marketCategories: string[];
	politicalMarketExposure: number;

	// Recent Activity
	recentTrades: Array<{
		timestamp: number;
		marketSlug: string;
		outcome: string;
		side: "BUY" | "SELL";
		amount: number;
		price: number;
	}>;

	// Timing Patterns
	tradesNearEventResolution: Array<{
		marketSlug: string;
		tradeTimestamp: number;
		hoursBeforeResolution: number;
		amount: number;
	}>;
}

// Market activity data for AI analysis
export interface MarketActivityData {
	marketId: string;
	marketSlug: string;
	question: string;
	endDate: number | null;

	// Recent trades
	trades: Array<{
		traderAddress: string;
		traderName: string | null;
		timestamp: number;
		side: "BUY" | "SELL";
		outcome: string;
		amount: number;
		price: number;
	}>;

	// Summary stats
	totalVolume: number;
	uniqueTraders: number;
	largeTradeCount: number;
	averageTradeSize: number;
}

// Alert evidence for flagging
export interface AlertEvidence {
	accountAgeDays?: number;
	tradeAmount?: number;
	winRate?: number;
	profitUsd?: number;
	hoursBeforeEvent?: number;
	nameChanges?: number;
	[key: string]: unknown;
}
