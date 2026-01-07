<script lang="ts">
	// In production, fetch from Convex
	const alerts = [
		{
			id: "1",
			severity: "high" as const,
			signalType: "new_account_large_bet",
			title: "New account with $45K bet on 2028 Election",
			account: "0x7f3a...9b2c",
			market: "2028 Presidential Election",
			createdAt: new Date(Date.now() - 10 * 60 * 1000),
			status: "new" as const,
		},
		{
			id: "2",
			severity: "medium" as const,
			signalType: "account_obfuscation",
			title: "Account name changed to random string",
			account: "0x2b1d...8e4f",
			market: "Who will win 2028?",
			createdAt: new Date(Date.now() - 45 * 60 * 1000),
			status: "investigating" as const,
		},
		{
			id: "3",
			severity: "low" as const,
			signalType: "statistical_improbability",
			title: "Unusual win rate detected (85%)",
			account: "0x9c4e...1a7b",
			market: "Various political markets",
			createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
			status: "new" as const,
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

	function formatTime(date: Date) {
		const diff = Date.now() - date.getTime();
		const minutes = Math.floor(diff / 60000);
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
		{#each alerts as alert}
			<a href="/alerts/{alert.id}" class="alert-card">
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
					<span>Account: {alert.account}</span>
					<span>Market: {alert.market}</span>
					<span>{formatTime(alert.createdAt)}</span>
				</div>
			</a>
		{/each}
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
</style>
