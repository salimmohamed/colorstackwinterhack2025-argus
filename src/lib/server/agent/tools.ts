/**
 * Agent tool definitions
 * These 3 tools enable Claude to gather data and flag suspicious accounts
 */

import type { Tool } from "./types";

export const agentTools: Tool[] = [
	{
		name: "fetch_account_data",
		description: `Fetches ALL available data about a Polymarket account.
Returns comprehensive data including:
- Account age (when first trade was made)
- Display name history (name changes can indicate obfuscation)
- Complete trading history with volumes
- Win/loss record and calculated win rate
- Trade sizes and patterns
- Market category exposure

Use this to gather evidence before making a judgment about insider trading.
The data structure matches patterns from known insider cases:
- Maduro trader: new account, large bet, name changed to random string
- AlphaRaccoon: 22/23 correct predictions, statistically impossible win rate`,
		input_schema: {
			type: "object",
			properties: {
				address: {
					type: "string",
					description: "Wallet address (0x...)",
				},
			},
			required: ["address"],
		},
	},
	{
		name: "fetch_market_activity",
		description: `Fetches recent trading activity for a specific market.
Returns:
- All trades in the specified timeframe
- Trader addresses and display names
- Trade sizes, prices, and outcomes
- Volume summary statistics

Use this to identify which accounts to investigate on a monitored market.
Look for:
- Unusually large trades (>$5,000)
- New accounts making their first big bets
- Concentrated activity from single traders
- Timing patterns near event resolution`,
		input_schema: {
			type: "object",
			properties: {
				marketId: {
					type: "string",
					description: "Market condition ID or slug",
				},
				hoursBack: {
					type: "number",
					description: "Hours of history to fetch (default 72)",
				},
				minTradeSize: {
					type: "number",
					description: "Minimum trade size in USDC to include",
				},
			},
			required: ["marketId"],
		},
	},
	{
		name: "flag_suspicious_account",
		description: `Creates an alert for a suspicious account in the database.
Use ONLY after analyzing account data and determining insider trading signals are present.

Required fields:
- address: The wallet address to flag
- severity: low/medium/high/critical based on confidence and evidence strength
- title: Brief description (e.g., "New account with $50K bet before event")
- reasoning: Detailed explanation of WHY this account is suspicious

The reasoning should reference specific data points and compare to known patterns:
- How does this compare to the Maduro trader pattern?
- How does this compare to the AlphaRaccoon pattern?
- What specific metrics are concerning?

Be thorough but avoid false positives. Only flag accounts with clear evidence.`,
		input_schema: {
			type: "object",
			properties: {
				address: {
					type: "string",
					description: "Wallet address to flag",
				},
				marketId: {
					type: "string",
					description: "Market ID where suspicious activity was detected",
				},
				severity: {
					type: "string",
					enum: ["low", "medium", "high", "critical"],
					description: "Alert severity level",
				},
				title: {
					type: "string",
					description: "Brief alert title",
				},
				reasoning: {
					type: "string",
					description: "Detailed explanation of why this account is suspicious",
				},
				evidence: {
					type: "object",
					description: "Key metrics supporting the flag",
					properties: {
						accountAgeDays: { type: "number" },
						tradeAmount: { type: "number" },
						winRate: { type: "number" },
						profitUsd: { type: "number" },
						hoursBeforeEvent: { type: "number" },
						nameChanges: { type: "number" },
					},
				},
			},
			required: ["address", "severity", "title", "reasoning"],
		},
	},
];

export default agentTools;
