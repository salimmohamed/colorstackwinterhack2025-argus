<script lang="ts">
	import { useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";

	const alertsQuery = useQuery(api.alerts.listRecent, { limit: 50 });

	function getSeverityColor(severity: "low" | "medium" | "high" | "critical") {
		const colors = {
			low: "#4caf50",
			medium: "#ff9800",
			high: "#f44336",
			critical: "#9c27b0",
		};
		return colors[severity];
	}

	function formatTime(timestamp: number) {
		const diff = Date.now() - timestamp;
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return "Just now";
		if (minutes < 60) return `${minutes} min ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} hours ago`;
		return `${Math.floor(hours / 24)} days ago`;
	}
</script>

<div class="alerts-page">
	<header class="page-header">
		<h1>Alerts</h1>
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
			<div class="loading">Loading alerts...</div>
		{:else if alertsQuery.data?.length === 0}
			<div class="empty-state">
				<h3>No alerts yet</h3>
				<p>The agent will create alerts when it detects suspicious activity.</p>
			</div>
		{:else}
			{#each alertsQuery.data ?? [] as alert}
				<a href="/alerts/{alert._id}" class="alert-card">
					<div class="alert-header">
						<span
							class="severity-badge"
							style="background-color: {getSeverityColor(alert.severity)}"
						>
							{alert.severity}
						</span>
						<span class="signal-type">{alert.signalType.replace(/_/g, " ")}</span>
						<span class="status-badge {alert.status}">{alert.status}</span>
					</div>
					<h3>{alert.title}</h3>
					<div class="alert-meta">
						<span>Account: {alert.accountAddress.slice(0, 6)}...{alert.accountAddress.slice(-4)}</span>
						<span>{formatTime(alert.createdAt)}</span>
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
		gap: 0.5rem;
	}

	.filters select {
		padding: 0.5rem 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
	}

	.alerts-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.alert-card {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		text-decoration: none;
		transition: box-shadow 0.2s;
	}

	.alert-card:hover {
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.alert-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.severity-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		color: white;
		font-size: 0.75rem;
		font-weight: bold;
		text-transform: uppercase;
	}

	.signal-type {
		font-size: 0.875rem;
		color: #666;
		text-transform: capitalize;
	}

	.status-badge {
		margin-left: auto;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: bold;
		text-transform: uppercase;
	}

	.status-badge.new {
		background: #e3f2fd;
		color: #1976d2;
	}

	.status-badge.investigating {
		background: #fff3e0;
		color: #e65100;
	}

	.status-badge.confirmed {
		background: #ffebee;
		color: #c62828;
	}

	.status-badge.dismissed {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.alert-card h3 {
		margin: 0 0 0.5rem;
		color: #1a1a2e;
		font-size: 1.125rem;
	}

	.alert-meta {
		display: flex;
		gap: 1.5rem;
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
