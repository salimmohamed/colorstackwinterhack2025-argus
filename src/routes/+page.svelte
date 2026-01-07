<script lang="ts">
	import { useQuery, useConvexClient } from "convex-svelte";
	import { api } from "../../convex/_generated/api.js";

	const marketsQuery = useQuery(api.markets.listActive, {});
	const alertsQuery = useQuery(api.alerts.listRecent, { limit: 5 });
	const agentRunsQuery = useQuery(api.agentRuns.listRecent, { limit: 1 });

	const client = useConvexClient();

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
		const days = Math.floor(hours / 24);
		return `${days} days ago`;
	}

	async function triggerAgentRun() {
		try {
			const response = await fetch("/api/agent/trigger", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ marketIds: ["2028-presidential-election"] }),
			});
			const result = await response.json();
			console.log("Agent triggered:", result);
		} catch (error) {
			console.error("Failed to trigger agent:", error);
		}
	}
</script>

<div class="dashboard">
	<h1>Dashboard</h1>

	<section class="stats-grid">
		<div class="stat-card">
			<h3>Markets Monitored</h3>
			<p class="stat-value">
				{#if marketsQuery.isLoading}
					...
				{:else}
					{marketsQuery.data?.length ?? 0}
				{/if}
			</p>
		</div>
		<div class="stat-card">
			<h3>Accounts Flagged</h3>
			<p class="stat-value">
				{#if alertsQuery.isLoading}
					...
				{:else}
					{alertsQuery.data?.length ?? 0}
				{/if}
			</p>
		</div>
		<div class="stat-card">
			<h3>Active Alerts</h3>
			<p class="stat-value">
				{#if alertsQuery.isLoading}
					...
				{:else}
					{alertsQuery.data?.filter((a) => a.status === "new").length ?? 0}
				{/if}
			</p>
		</div>
		<div class="stat-card">
			<h3>Last Agent Run</h3>
			<p class="stat-value time">
				{#if agentRunsQuery.isLoading}
					...
				{:else if agentRunsQuery.data?.[0]}
					{formatTime(agentRunsQuery.data[0].startedAt)}
				{:else}
					Never
				{/if}
			</p>
		</div>
	</section>

	<section class="alerts-section">
		<div class="section-header">
			<h2>Recent Alerts</h2>
			<a href="/alerts" class="view-all">View All →</a>
		</div>

		<div class="alerts-list">
			{#if alertsQuery.isLoading}
				<div class="loading">Loading alerts...</div>
			{:else if alertsQuery.data?.length === 0}
				<div class="empty-state">No alerts yet. The agent will flag suspicious activity.</div>
			{:else}
				{#each alertsQuery.data ?? [] as alert}
					<a href="/alerts/{alert._id}" class="alert-card">
						<span
							class="severity-badge"
							style="background-color: {getSeverityColor(alert.severity)}"
						>
							{alert.severity}
						</span>
						<div class="alert-content">
							<h4>{alert.title}</h4>
							<p class="alert-meta">
								Account: {alert.accountAddress.slice(0, 6)}...{alert.accountAddress.slice(-4)} • {formatTime(alert.createdAt)}
							</p>
						</div>
					</a>
				{/each}
			{/if}
		</div>
	</section>

	<section class="agent-section">
		<h2>Agent Status</h2>
		<div class="agent-status">
			{#if agentRunsQuery.data?.[0]?.status === "running"}
				<div class="status-indicator running"></div>
				<span>Agent is analyzing markets</span>
			{:else}
				<div class="status-indicator idle"></div>
				<span>Agent is idle</span>
			{/if}
			<button class="trigger-btn" onclick={triggerAgentRun}>Trigger Manual Run</button>
		</div>
	</section>
</div>

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	h1 {
		font-size: 2rem;
		color: #1a1a2e;
		margin: 0;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.stat-card {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.stat-card h3 {
		margin: 0;
		font-size: 0.875rem;
		color: #666;
		font-weight: normal;
	}

	.stat-value {
		margin: 0.5rem 0 0;
		font-size: 2rem;
		font-weight: bold;
		color: #1a1a2e;
	}

	.stat-value.time {
		font-size: 1.25rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #1a1a2e;
	}

	.view-all {
		color: #666;
		text-decoration: none;
		font-size: 0.875rem;
	}

	.view-all:hover {
		color: #1a1a2e;
	}

	.alerts-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.alert-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: white;
		border-radius: 8px;
		padding: 1rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		text-decoration: none;
		transition: box-shadow 0.2s;
	}

	.alert-card:hover {
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.severity-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		color: white;
		font-size: 0.75rem;
		font-weight: bold;
		text-transform: uppercase;
	}

	.alert-content {
		flex: 1;
	}

	.alert-content h4 {
		margin: 0;
		color: #1a1a2e;
		font-size: 1rem;
	}

	.alert-meta {
		margin: 0.25rem 0 0;
		color: #666;
		font-size: 0.875rem;
	}

	.agent-status {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: white;
		border-radius: 8px;
		padding: 1rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-top: 1rem;
	}

	.status-indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.status-indicator.running {
		background: #4caf50;
		animation: pulse 2s infinite;
	}

	.status-indicator.idle {
		background: #9e9e9e;
	}

	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
		}
	}

	.trigger-btn {
		margin-left: auto;
		padding: 0.5rem 1rem;
		background: #1a1a2e;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.trigger-btn:hover {
		background: #2a2a4e;
	}

	.loading,
	.empty-state {
		background: white;
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
		color: #666;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}
</style>
