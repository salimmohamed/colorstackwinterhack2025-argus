<script lang="ts">
	// Dashboard metrics (in production, fetch from Convex)
	const stats = {
		marketsMonitored: 5,
		accountsAnalyzed: 127,
		alertsGenerated: 3,
		lastRunTime: "2 minutes ago",
	};

	const recentAlerts = [
		{
			id: "1",
			severity: "high" as const,
			title: "New account with $45K bet on 2028 Election",
			account: "0x7f3a...9b2c",
			timestamp: "10 min ago",
		},
		{
			id: "2",
			severity: "medium" as const,
			title: "Account name changed to random string",
			account: "0x2b1d...8e4f",
			timestamp: "45 min ago",
		},
		{
			id: "3",
			severity: "low" as const,
			title: "Unusual win rate detected (85%)",
			account: "0x9c4e...1a7b",
			timestamp: "2 hours ago",
		},
	];

	function getSeverityColor(severity: "low" | "medium" | "high" | "critical") {
		const colors = {
			low: "#4caf50",
			medium: "#ff9800",
			high: "#f44336",
			critical: "#9c27b0",
		};
		return colors[severity];
	}
</script>

<div class="dashboard">
	<h1>Dashboard</h1>

	<section class="stats-grid">
		<div class="stat-card">
			<h3>Markets Monitored</h3>
			<p class="stat-value">{stats.marketsMonitored}</p>
		</div>
		<div class="stat-card">
			<h3>Accounts Analyzed</h3>
			<p class="stat-value">{stats.accountsAnalyzed}</p>
		</div>
		<div class="stat-card">
			<h3>Alerts Generated</h3>
			<p class="stat-value">{stats.alertsGenerated}</p>
		</div>
		<div class="stat-card">
			<h3>Last Agent Run</h3>
			<p class="stat-value time">{stats.lastRunTime}</p>
		</div>
	</section>

	<section class="alerts-section">
		<div class="section-header">
			<h2>Recent Alerts</h2>
			<a href="/alerts" class="view-all">View All →</a>
		</div>

		<div class="alerts-list">
			{#each recentAlerts as alert}
				<a href="/alerts/{alert.id}" class="alert-card">
					<span
						class="severity-badge"
						style="background-color: {getSeverityColor(alert.severity)}"
					>
						{alert.severity}
					</span>
					<div class="alert-content">
						<h4>{alert.title}</h4>
						<p class="alert-meta">
							Account: {alert.account} • {alert.timestamp}
						</p>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<section class="agent-section">
		<h2>Agent Status</h2>
		<div class="agent-status">
			<div class="status-indicator running"></div>
			<span>Agent is monitoring markets</span>
			<button class="trigger-btn">Trigger Manual Run</button>
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
</style>
