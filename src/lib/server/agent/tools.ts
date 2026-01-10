/**
 * Agent tool definitions
 * These tools enable Claude to gather data and make AI-driven judgments
 * about potential insider trading (Software 3.0 approach)
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
- All current positions with P&L
- Win/loss record and calculated win rate
- Trade sizes and patterns
- Market category exposure

IMPORTANT: This returns RAW DATA for you to analyze. Do not apply rigid rules.
Instead, use your judgment to assess whether the pattern looks like insider trading.

Known insider patterns to consider:
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
- Average trade size for context

Use this to identify which accounts warrant deeper investigation.
The data includes market context so you can assess whether trades are
unusually large RELATIVE to the market, not just absolute thresholds.`,
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
		name: "fetch_market_holders",
		description: `Fetches the position distribution for a market.

Returns:
- All holders and their position sizes
- Position distribution across outcomes
- Total market position value
- Concentration metrics (who controls how much)

Use this to identify:
- Wallets with disproportionate market control
- Unusual concentration of positions
- Potential market manipulation through large holdings`,
		input_schema: {
			type: "object",
			properties: {
				marketId: {
					type: "string",
					description: "Market condition ID",
				},
			},
			required: ["marketId"],
		},
	},
	{
		name: "fetch_wallet_positions",
		description: `Fetches all current positions for a wallet.

Returns:
- All open positions across markets
- P&L for each position (realized and unrealized)
- Entry prices and current values
- Market diversification

Use this to understand:
- How concentrated a trader's bets are
- Their overall profit/loss profile
- Whether they're betting across many markets or focused on specific ones`,
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
		name: "compare_to_market",
		description: `Compares a specific trade or trader to market context.

Returns relative metrics:
- Trade size vs market average (e.g., "5x larger than average")
- Position size vs total market (e.g., "controls 40% of YES positions")
- Activity frequency vs typical traders
- Profit percentile among all traders

This helps you make RELATIVE judgments rather than absolute ones.
A $5000 trade might be normal in a high-volume market but suspicious
in a low-liquidity market.`,
		input_schema: {
			type: "object",
			properties: {
				address: {
					type: "string",
					description: "Wallet address to compare",
				},
				marketId: {
					type: "string",
					description: "Market to compare against",
				},
			},
			required: ["address", "marketId"],
		},
	},
	{
		name: "flag_suspicious_account",
		description: `Creates an alert for a suspicious account in the database.

Use this ONLY after thorough analysis. Your judgment should be based on:
1. Pattern recognition - does this look like known insider cases?
2. Statistical anomalies - is the success rate improbable?
3. Behavioral signals - name changes, concentrated bets, timing
4. Context - relative to market conditions, not just absolute numbers

CRITICAL: You are the judge. There are no rigid score thresholds.
Ask yourself: "If I were investigating insider trading, would this
account warrant a closer look?" If yes, flag it with clear reasoning.

Your reasoning should explain WHY this account is suspicious in
natural language, referencing specific data points and patterns.`,
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
					description: "Alert severity based on your confidence and evidence strength",
				},
				signalType: {
					type: "string",
					enum: [
						"new_account_large_bet",
						"timing_correlation",
						"statistical_improbability",
						"account_obfuscation",
						"disproportionate_bet",
						"pattern_match",
					],
					description: "Primary type of suspicious signal detected",
				},
				title: {
					type: "string",
					description: "Brief descriptive title for the alert",
				},
				reasoning: {
					type: "string",
					description: "Detailed explanation of WHY this account is suspicious",
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
						marketDominance: { type: "number" },
						relativeBetSize: { type: "number" },
					},
				},
			},
			required: ["address", "severity", "signalType", "title", "reasoning"],
		},
	},
];

export default agentTools;
