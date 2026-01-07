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
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	async function syncMarkets() {
		try {
			const res = await fetch("/api/markets/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ limit: 10 }),
			});
			const data = await res.json();
			console.log("Sync result:", data);
		} catch (e) {
			console.error("Sync failed:", e);
		}
	}
</script>

<svelte:head>
	<title>Markets — Argus</title>
</svelte:head>

<div class="markets-page">
	<header class="page-header">
		<div class="header-content">
			<h1>◎ Monitored Markets</h1>
			<p class="subtitle">Political prediction markets under surveillance</p>
		</div>
		<button class="sync-btn" onclick={syncMarkets}>
			<span>↻</span> Sync Markets
		</button>
	</header>

	<div class="markets-grid">
		{#if $marketsQuery === undefined}
			<div class="loading">
				<span class="loading-eye">◉</span>
				<p>Loading markets...</p>
			</div>
		{:else if $marketsQuery?.length === 0}
			<div class="empty-state">
				<span class="empty-icon">◎</span>
				<h3>No markets being monitored</h3>
				<p>Add a Polymarket market to start monitoring for insider trading.</p>
				<button class="sync-btn" onclick={syncMarkets}>Sync from Polymarket</button>
			</div>
		{:else}
			{#each $marketsQuery ?? [] as market}
				<div class="market-card">
					<div class="market-header">
						<span class="category-badge">{market.category}</span>
						<span class="volume-badge">{formatVolume(market.totalVolume)}</span>
					</div>
					<h3>{market.question}</h3>
					<div class="outcomes">
						{#each market.outcomes as outcome, i}
							<div class="outcome" class:leader={i === 0}>
								<div class="outcome-info">
									<span class="outcome-rank">#{i + 1}</span>
									<span class="outcome-name">{outcome.name}</span>
								</div>
								<div class="outcome-price-wrap">
									<span class="outcome-price">{(outcome.price * 100).toFixed(0)}%</span>
									<div class="price-bar" style="width: {outcome.price * 100}%"></div>
								</div>
							</div>
						{/each}
					</div>
					<div class="market-footer">
						<span class="status">
							<span class="status-dot"></span>
							Active
						</span>
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
		gap: 2rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #1a1a1a;
	}

	.header-content h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #fafafa;
	}

	.subtitle {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: #666;
	}

	.sync-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid #252525;
		border-radius: 4px;
		color: #888;
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.sync-btn:hover {
		border-color: #f59e0b;
		color: #f59e0b;
		box-shadow: 0 0 15px rgba(245, 158, 11, 0.15);
	}

	.markets-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
		gap: 1rem;
	}

	.market-card {
		background: #0a0a0a;
		border: 1px solid #1a1a1a;
		border-radius: 8px;
		padding: 1.25rem;
		transition: all 0.2s;
	}

	.market-card:hover {
		border-color: #252525;
		box-shadow: 0 0 30px rgba(0, 0, 0, 0.3);
	}

	.market-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.category-badge {
		padding: 0.2rem 0.5rem;
		background: rgba(245, 158, 11, 0.1);
		color: #f59e0b;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.volume-badge {
		font-size: 0.75rem;
		color: #22c55e;
		font-weight: 600;
	}

	.market-card h3 {
		margin: 0 0 1rem;
		color: #fafafa;
		font-size: 0.95rem;
		font-weight: 500;
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
		padding: 0.6rem 0.75rem;
		background: #111111;
		border: 1px solid #1a1a1a;
		border-radius: 4px;
		position: relative;
		overflow: hidden;
	}

	.outcome.leader {
		border-color: rgba(245, 158, 11, 0.3);
		background: rgba(245, 158, 11, 0.05);
	}

	.outcome-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		z-index: 1;
	}

	.outcome-rank {
		font-size: 0.65rem;
		color: #444;
		font-weight: 600;
	}

	.outcome.leader .outcome-rank {
		color: #f59e0b;
	}

	.outcome-name {
		font-size: 0.8rem;
		color: #ccc;
		font-weight: 500;
	}

	.outcome.leader .outcome-name {
		color: #fafafa;
	}

	.outcome-price-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		z-index: 1;
	}

	.outcome-price {
		font-size: 0.8rem;
		font-weight: 700;
		color: #888;
		min-width: 40px;
		text-align: right;
	}

	.outcome.leader .outcome-price {
		color: #f59e0b;
	}

	.price-bar {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: rgba(255, 255, 255, 0.02);
		z-index: 0;
	}

	.outcome.leader .price-bar {
		background: rgba(245, 158, 11, 0.05);
	}

	.market-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.75rem;
		border-top: 1px solid #1a1a1a;
		font-size: 0.7rem;
		color: #444;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #22c55e;
	}

	.loading,
	.empty-state {
		background: #0a0a0a;
		border: 1px solid #1a1a1a;
		border-radius: 8px;
		padding: 4rem 2rem;
		text-align: center;
		grid-column: 1 / -1;
	}

	.loading-eye {
		font-size: 2rem;
		color: #f59e0b;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.loading p {
		margin: 1rem 0 0;
		color: #666;
		font-size: 0.8rem;
	}

	.empty-icon {
		font-size: 2.5rem;
		color: #333;
		display: block;
		margin-bottom: 1rem;
	}

	.empty-state h3 {
		margin: 0 0 0.5rem;
		color: #fafafa;
		font-size: 1rem;
	}

	.empty-state p {
		margin: 0 0 1.5rem;
		color: #666;
		font-size: 0.85rem;
	}

	@media (max-width: 768px) {
		.markets-grid {
			grid-template-columns: 1fr;
		}

		.page-header {
			flex-direction: column;
			gap: 1rem;
		}
	}
</style>
