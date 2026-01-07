<script lang="ts">
	import { useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";

	const alertsQuery = useQuery(api.alerts.listRecent, () => ({ limit: 50 }));

	function getSeverityColor(severity: "low" | "medium" | "high" | "critical") {
		const colors = {
			low: "#22c55e",
			medium: "#f59e0b",
			high: "#ef4444",
			critical: "#a855f7",
		};
		return colors[severity];
	}

	function formatTime(timestamp: number) {
		const diff = Date.now() - timestamp;
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return "Just now";
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}
</script>

<svelte:head>
	<title>Alerts — Argus</title>
</svelte:head>

<div class="alerts-page">
	<header class="page-header">
		<div class="header-content">
			<h1>⚠ Detection Alerts</h1>
			<p class="subtitle">Suspicious trading patterns flagged by Argus</p>
		</div>
		<div class="filters">
			<select>
				<option value="">All Severities</option>
				<option value="critical">Critical</option>
				<option value="high">High</option>
				<option value="medium">Medium</option>
				<option value="low">Low</option>
			</select>
			<select>
				<option value="">All Statuses</option>
				<option value="new">New</option>
				<option value="investigating">Investigating</option>
				<option value="confirmed">Confirmed</option>
				<option value="dismissed">Dismissed</option>
			</select>
		</div>
	</header>

	<div class="alerts-list">
		{#if alertsQuery.isLoading}
			<div class="loading">
				<span class="loading-eye">◉</span>
				<p>Loading alerts...</p>
			</div>
		{:else if !alertsQuery.data || alertsQuery.data.length === 0}
			<div class="empty-state">
				<span class="empty-icon">◎</span>
				<h3>No alerts detected</h3>
				<p>The agent will create alerts when it detects suspicious trading activity.</p>
			</div>
		{:else}
			{#each alertsQuery.data as alert}
				<a href="/alerts/{alert._id}" class="alert-card">
					<div class="alert-header">
						<span class="severity-badge" style="background-color: {getSeverityColor(alert.severity)}">
							{alert.severity}
						</span>
						<span class="signal-type">{alert.signalType.replace(/_/g, " ")}</span>
						<span class="status-badge {alert.status}">{alert.status}</span>
					</div>
					<h3>{alert.title}</h3>
					<p class="reasoning">{alert.reasoning.slice(0, 150)}...</p>
					<div class="alert-meta">
						<span class="account">
							<span class="label">Account:</span>
							{alert.accountAddress.slice(0, 6)}...{alert.accountAddress.slice(-4)}
						</span>
						<span class="time">{formatTime(alert.createdAt)}</span>
					</div>
				</a>
			{/each}
		{/if}
	</div>
</div>

<style>
	.alerts-page {
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

	.filters {
		display: flex;
		gap: 0.5rem;
	}

	.filters select {
		padding: 0.5rem 1rem;
		background: #0a0a0a;
		border: 1px solid #252525;
		border-radius: 4px;
		color: #888;
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.filters select:hover {
		border-color: #f59e0b;
		color: #f59e0b;
	}

	.alerts-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.alert-card {
		background: #0a0a0a;
		border: 1px solid #1a1a1a;
		border-radius: 8px;
		padding: 1.25rem;
		text-decoration: none;
		transition: all 0.2s;
	}

	.alert-card:hover {
		border-color: #252525;
		background: #0f0f0f;
	}

	.alert-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.severity-badge {
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		color: white;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.signal-type {
		font-size: 0.75rem;
		color: #666;
		text-transform: capitalize;
	}

	.status-badge {
		margin-left: auto;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-badge.new {
		background: rgba(59, 130, 246, 0.15);
		color: #3b82f6;
	}

	.status-badge.investigating {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.status-badge.confirmed {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.status-badge.dismissed {
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
	}

	.alert-card h3 {
		margin: 0 0 0.5rem;
		color: #fafafa;
		font-size: 1rem;
		font-weight: 500;
	}

	.reasoning {
		margin: 0 0 0.75rem;
		color: #666;
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.alert-meta {
		display: flex;
		justify-content: space-between;
		padding-top: 0.75rem;
		border-top: 1px solid #1a1a1a;
		font-size: 0.75rem;
		color: #444;
	}

	.label {
		color: #333;
	}

	.account {
		font-family: 'JetBrains Mono', monospace;
	}

	.loading,
	.empty-state {
		background: #0a0a0a;
		border: 1px solid #1a1a1a;
		border-radius: 8px;
		padding: 4rem 2rem;
		text-align: center;
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
		margin: 0;
		color: #666;
		font-size: 0.85rem;
	}

	@media (max-width: 640px) {
		.page-header {
			flex-direction: column;
			gap: 1rem;
		}

		.filters {
			width: 100%;
		}

		.filters select {
			flex: 1;
		}
	}
</style>
