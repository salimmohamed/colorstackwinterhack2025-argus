<script lang="ts">
	// In production, fetch from Convex
	const accounts = [
		{
			address: "0x7f3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a",
			displayName: "SuspiciousTrader42",
			riskScore: 87,
			isFlagged: true,
			totalTrades: 12,
			totalVolume: 145000,
			winRate: 0.83,
			accountAgeDays: 14,
		},
		{
			address: "0x2b1d8e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
			displayName: "3f8a2b1c9d0e",
			riskScore: 65,
			isFlagged: true,
			totalTrades: 45,
			totalVolume: 89000,
			winRate: 0.67,
			accountAgeDays: 21,
		},
		{
			address: "0x9c4e1a7b2f3d8e5a6b0c9d4e7f8a1b2c3d5e6f7a",
			displayName: "PoliticalBettor",
			riskScore: 42,
			isFlagged: false,
			totalTrades: 156,
			totalVolume: 234000,
			winRate: 0.85,
			accountAgeDays: 180,
		},
	];

	function getRiskColor(score: number) {
		if (score >= 70) return "#f44336";
		if (score >= 40) return "#ff9800";
		return "#4caf50";
	}

	function shortenAddress(addr: string) {
		return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
	}

	function formatVolume(vol: number) {
		if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
		if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
		return `$${vol}`;
	}
</script>

<div class="accounts-page">
	<header class="page-header">
		<h1>Accounts</h1>
		<div class="filters">
			<label>
				<input type="checkbox" checked /> Flagged Only
			</label>
			<select>
				<option value="riskScore">Sort by Risk Score</option>
				<option value="volume">Sort by Volume</option>
				<option value="winRate">Sort by Win Rate</option>
			</select>
		</div>
	</header>

	<div class="accounts-table">
		<div class="table-header">
			<span>Account</span>
			<span>Risk Score</span>
			<span>Trades</span>
			<span>Volume</span>
			<span>Win Rate</span>
			<span>Age</span>
		</div>
		{#each accounts as account}
			<a
				href="/accounts/{account.address}"
				class="table-row"
				class:flagged={account.isFlagged}
			>
				<div class="account-cell">
					<span class="address">{shortenAddress(account.address)}</span>
					<span class="display-name">{account.displayName}</span>
				</div>
				<div class="risk-cell">
					<div
						class="risk-bar"
						style="width: {account.riskScore}%; background: {getRiskColor(account.riskScore)}"
					></div>
					<span>{account.riskScore}</span>
				</div>
				<span>{account.totalTrades}</span>
				<span>{formatVolume(account.totalVolume)}</span>
				<span>{(account.winRate * 100).toFixed(0)}%</span>
				<span>{account.accountAgeDays} days</span>
			</a>
		{/each}
	</div>
</div>

<style>
	.accounts-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.page-header h1 {
		margin: 0;
		font-size: 2rem;
		color: #1a1a2e;
	}

	.filters {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.filters label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.filters select {
		padding: 0.5rem 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
	}

	.accounts-table {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	.table-header {
		display: grid;
		grid-template-columns: 2fr 1fr 0.75fr 1fr 0.75fr 0.75fr;
		gap: 1rem;
		padding: 1rem 1.5rem;
		background: #f5f5f5;
		font-weight: bold;
		font-size: 0.875rem;
		color: #666;
	}

	.table-row {
		display: grid;
		grid-template-columns: 2fr 1fr 0.75fr 1fr 0.75fr 0.75fr;
		gap: 1rem;
		padding: 1rem 1.5rem;
		align-items: center;
		border-top: 1px solid #eee;
		text-decoration: none;
		color: inherit;
		transition: background 0.2s;
	}

	.table-row:hover {
		background: #fafafa;
	}

	.table-row.flagged {
		border-left: 3px solid #f44336;
	}

	.account-cell {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.address {
		font-family: monospace;
		color: #1a1a2e;
	}

	.display-name {
		font-size: 0.875rem;
		color: #666;
	}

	.risk-cell {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.risk-bar {
		height: 8px;
		border-radius: 4px;
		max-width: 60px;
	}
</style>
