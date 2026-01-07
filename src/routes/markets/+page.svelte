<script lang="ts">
	import { useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";

	const marketsQuery = useQuery(api.markets.listActive, {});

	function formatVolume(vol: number) {
		if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
		if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
		return `$${vol}`;
	}

	function formatTime(timestamp: number) {
		const diff = Date.now() - timestamp;
		const minutes = Math.floor(diff / 60000);
		if (minutes < 60) return `${minutes} min ago`;
		const hours = Math.floor(minutes / 60);
		return `${hours} hours ago`;
	}
</script>

<div class="markets-page">
	<header class="page-header">
		<h1>Monitored Markets</h1>
		<button class="add-market-btn">+ Add Market</button>
	</header>

	<div class="markets-grid">
		{#if marketsQuery.isLoading}
			<div class="loading">Loading markets...</div>
		{:else if marketsQuery.data?.length === 0}
			<div class="empty-state">
				<h3>No markets being monitored</h3>
				<p>Add a Polymarket market to start monitoring for insider trading.</p>
			</div>
		{:else}
			{#each marketsQuery.data ?? [] as market}
				<div class="market-card">
					<div class="market-header">
						<span class="category-badge">{market.category}</span>
						<span class="status-indicator active"></span>
					</div>
					<h3>{market.question}</h3>
					<div class="outcomes">
						{#each market.outcomes as outcome}
							<div class="outcome">
								<span class="outcome-name">{outcome.name}</span>
								<span class="outcome-price">{(outcome.price * 100).toFixed(0)}%</span>
							</div>
						{/each}
					</div>
					<div class="market-footer">
						<span class="volume">Volume: {formatVolume(market.totalVolume)}</span>
						<span class="synced">Synced {formatTime(market.lastSyncedAt)}</span>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.markets-page {
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

	.add-market-btn {
		padding: 0.5rem 1rem;
		background: #1a1a2e;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.add-market-btn:hover {
		background: #2a2a4e;
	}

	.markets-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 1.5rem;
	}

	.market-card {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.market-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.category-badge {
		padding: 0.25rem 0.5rem;
		background: #e3f2fd;
		color: #1976d2;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: bold;
		text-transform: uppercase;
	}

	.status-indicator {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.status-indicator.active {
		background: #4caf50;
	}

	.market-card h3 {
		margin: 0 0 1rem;
		color: #1a1a2e;
		font-size: 1rem;
		line-height: 1.4;
	}

	.outcomes {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.outcome {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		background: #f5f5f5;
		border-radius: 4px;
	}

	.outcome-name {
		font-weight: 500;
		color: #1a1a2e;
	}

	.outcome-price {
		font-weight: bold;
		color: #1976d2;
	}

	.market-footer {
		display: flex;
		justify-content: space-between;
		color: #666;
		font-size: 0.875rem;
	}

	.loading,
	.empty-state {
		background: white;
		border-radius: 8px;
		padding: 3rem;
		text-align: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		grid-column: 1 / -1;
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
