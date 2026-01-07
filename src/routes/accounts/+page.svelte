<script lang="ts">
	import { useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";

	const accountsQuery = useQuery(api.accounts.listFlagged, {});

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
		<h1>Flagged Accounts</h1>
		<div class="filters">
			<select>
				<option value="riskScore">Sort by Risk Score</option>
				<option value="volume">Sort by Volume</option>
				<option value="winRate">Sort by Win Rate</option>
			</select>
		</div>
	</header>

	{#if accountsQuery.isLoading}
		<div class="loading">Loading accounts...</div>
	{:else if accountsQuery.data?.length === 0}
		<div class="empty-state">
			<h3>No flagged accounts</h3>
			<p>Accounts will appear here when the agent flags suspicious activity.</p>
		</div>
	{:else}
		<div class="accounts-table">
			<div class="table-header">
				<span>Account</span>
				<span>Risk Score</span>
				<span>Trades</span>
				<span>Volume</span>
				<span>Win Rate</span>
				<span>Age</span>
			</div>
			{#each accountsQuery.data ?? [] as account}
				<a
					href="/accounts/{account.address}"
					class="table-row flagged"
				>
					<div class="account-cell">
						<span class="address">{shortenAddress(account.address)}</span>
						{#if account.displayName}
							<span class="display-name">{account.displayName}</span>
						{/if}
					</div>
					<div class="risk-cell">
						<div
							class="risk-bar"
							style="width: {account.riskScore}%; background: {getRiskColor(account.riskScore)}"
						></div>
						<span>{account.riskScore}</span>
					</div>
					<span>{account.totalTrades ?? 0}</span>
					<span>{formatVolume(account.totalVolume ?? 0)}</span>
					<span>{((account.winRate ?? 0) * 100).toFixed(0)}%</span>
					<span>{account.accountAgeDays ?? "?"} days</span>
				</a>
			{/each}
		</div>
	{/if}
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

	.loading,
	.empty-state {
		background: white;
		border-radius: 8px;
		padding: 3rem;
		text-align: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.empty-state h3 {
		margin: 0 0 0.5rem;
		color: #1a1a2e;
	}

	.empty-state p {
		margin: 0;
		color: #666;
	}
</style>
