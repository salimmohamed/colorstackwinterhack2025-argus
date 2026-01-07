<script lang="ts">
	import { useQuery, useConvexClient } from "convex-svelte";
	import { api } from "../../convex/_generated/api.js";

	const marketsQuery = useQuery(api.markets.listActive, {});
	const alertsQuery = useQuery(api.alerts.listRecent, { limit: 5 });
	const agentRunsQuery = useQuery(api.agentRuns.listRecent, { limit: 1 });

	const client = useConvexClient();

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
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
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

	// ASCII Art of Argus Panoptes - the hundred-eyed giant
	const argusAscii = `
                      .  :  .
                   .    ◉    .
                .    .     .    .
              .   ◉    . .    ◉   .
            .        .---.        .
          .    ◉    /  ◉  \\    ◉    .
         .        ./       \\.        .
        .   ◉    /    ◉ ◉    \\    ◉   .
       .        |   .-----.   |        .
      .    ◉    |  /  ◉ ◉  \\  |    ◉    .
      .        |  |  .---.  |  |        .
     .   ◉     |  | ( ◉_◉ ) |  |     ◉   .
     .         |  |  '---'  |  |         .
    .    ◉     |  \\   ◉ ◉   /  |     ◉    .
    .         |    '.___.'    |         .
    .   ◉      |   ◉  |  ◉   |      ◉   .
   .          |      |      |          .
   .    ◉      \\  ◉  |  ◉  /      ◉    .
   .           \\    |    /           .
   .   ◉        \\   |   /        ◉   .
  .             \\◉ | ◉/             .
  .    ◉         \\ | /         ◉    .
  .              \\|/              .
  .   ◉     ◉     |     ◉     ◉   .
  .              /|\\              .
  .    ◉        / | \\        ◉    .
  .            /◉ | ◉\\            .
   .   ◉      /   |   \\      ◉   .
   .         /  ◉ | ◉  \\         .
   .    ◉   /     |     \\   ◉    .
   .       |   ◉  |  ◉   |       .
    .   ◉  |      |      |  ◉   .
    .      |  ◉   |   ◉  |      .
    .    ◉  \\     |     /  ◉    .
     .      \\  ◉ | ◉  /      .
     .   ◉   \\   |   /   ◉   .
      .       \\  |  /       .
      .    ◉   \\ | /   ◉    .
       .        \\|/        .
        .   ◉    |    ◉   .
         .      /|\\      .
          .    / | \\    .
           .  /  |  \\  .
            ./   |   \\.
             .   |   .
              .  |  .
               . | .
                .|.                            `;
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
	<title>Argus — The All-Seeing Eye</title>
</svelte:head>

<div class="page">
	<!-- Scanline overlay -->
	<div class="scanlines"></div>

	<!-- Floating eyes background -->
	<div class="eyes-bg" aria-hidden="true">
		{#each Array(40) as _, i}
			<span
				class="floating-eye"
				style="
					left: {Math.random() * 100}%;
					top: {Math.random() * 100}%;
					animation-delay: {Math.random() * 8}s;
					opacity: {0.02 + Math.random() * 0.06};
					font-size: {1 + Math.random() * 2}rem;
				"
			>◉</span>
		{/each}
	</div>

	<div class="container">
		<!-- Header -->
		<header class="header">
			<div class="logo-group">
				<span class="logo-eye">◉</span>
				<h1 class="logo">ARGUS</h1>
			</div>
			<nav class="nav">
				<a href="/markets" class="nav-link">Markets</a>
				<a href="/alerts" class="nav-link">Alerts</a>
				<a href="/accounts" class="nav-link">Accounts</a>
			</nav>
		</header>

		<main class="main">
			<!-- Left: Content -->
			<div class="content">
				<div class="hero">
					<p class="tagline">THE ALL-SEEING EYE</p>
					<h2 class="headline">Polymarket Insider<br/>Trading Detection</h2>
					<p class="description">
						Autonomous AI surveillance monitoring political prediction markets.
						Some eyes sleep while others watch — Argus never rests.
					</p>
				</div>

				<!-- Terminal -->
				<div class="terminal">
					<div class="terminal-bar">
						<span class="dot dot-red"></span>
						<span class="dot dot-yellow"></span>
						<span class="dot dot-green"></span>
						<span class="terminal-title">argus_daemon.log</span>
					</div>
					<div class="terminal-body">
						<p><span class="prompt">$</span> argus --status</p>
						<p class="output">[{new Date().toISOString().split('T')[0]}] System initialized</p>
						<p class="output">Monitoring <span class="hl">{$marketsQuery?.length ?? 0}</span> markets</p>
						<p class="output">Active alerts: <span class="hl alert">{$alertsQuery?.filter((a: any) => a.status === "new").length ?? 0}</span></p>
						<p class="output">Status: <span class="hl success">WATCHING</span></p>
						<p class="cursor">█</p>
					</div>
				</div>

				<!-- Stats -->
				<div class="stats">
					<div class="stat">
						<span class="stat-icon">◎</span>
						<div class="stat-data">
							<span class="stat-value">
								{#if $marketsQuery}
									{$marketsQuery.length}
								{:else}
									—
								{/if}
							</span>
							<span class="stat-label">Markets</span>
						</div>
					</div>
					<div class="stat stat-alert">
						<span class="stat-icon">⚠</span>
						<div class="stat-data">
							<span class="stat-value">
								{#if $alertsQuery}
									{$alertsQuery.length}
								{:else}
									—
								{/if}
							</span>
							<span class="stat-label">Alerts</span>
						</div>
					</div>
					<div class="stat">
						<span class="stat-icon">◉</span>
						<div class="stat-data">
							<span class="stat-value">100</span>
							<span class="stat-label">Eyes</span>
						</div>
					</div>
					<div class="stat">
						<span class="stat-icon">⟁</span>
						<div class="stat-data">
							<span class="stat-value">24/7</span>
							<span class="stat-label">Watch</span>
						</div>
					</div>
				</div>

				<!-- Recent Alerts -->
				{#if $alertsQuery && $alertsQuery.length > 0}
					<div class="alerts-section">
						<div class="section-head">
							<h3>Recent Detections</h3>
							<a href="/alerts" class="link">View all →</a>
						</div>
						<div class="alerts-list">
							{#each $alertsQuery.slice(0, 3) as alert}
								<a href="/alerts/{alert._id}" class="alert-item">
									<span class="alert-severity" style="background: {getSeverityColor(alert.severity)}">{alert.severity}</span>
									<span class="alert-title">{alert.title}</span>
									<span class="alert-time">{formatTime(alert.createdAt)}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Agent Control -->
				<div class="agent-control">
					<div class="agent-status">
						{#if $agentRunsQuery?.[0]?.status === "running"}
							<span class="status-dot running"></span>
							<span>Agent analyzing</span>
						{:else}
							<span class="status-dot idle"></span>
							<span>Agent idle</span>
						{/if}
					</div>
					<button class="btn" onclick={triggerAgentRun}>
						<span>▶</span> Trigger Scan
					</button>
				</div>

				<!-- Quote -->
				<footer class="quote">
					<p>"He had a hundred eyes, of which only two would sleep at a time while the rest kept watch."</p>
					<cite>— Ovid, Metamorphoses</cite>
				</footer>
			</div>

			<!-- Right: ASCII Art -->
			<aside class="ascii-side" aria-hidden="true">
				<pre class="ascii-art">{argusAscii}</pre>
			</aside>
		</main>
	</div>
</div>

<style>
	:root {
		--bg-dark: #030303;
		--bg-card: #0a0a0a;
		--bg-hover: #111111;
		--border: #1a1a1a;
		--border-light: #252525;
		--text: #fafafa;
		--text-dim: #888888;
		--text-muted: #444444;
		--accent: #f59e0b;
		--accent-glow: rgba(245, 158, 11, 0.2);
		--alert: #ef4444;
		--success: #22c55e;
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		background: var(--bg-dark);
		color: var(--text);
		font-family: 'JetBrains Mono', 'SF Mono', monospace;
		-webkit-font-smoothing: antialiased;
	}

	.page {
		min-height: 100vh;
		position: relative;
		overflow: hidden;
	}

	/* Scanlines */
	.scanlines {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 100;
		background: repeating-linear-gradient(
			0deg,
			rgba(0, 0, 0, 0.15) 0px,
			rgba(0, 0, 0, 0.15) 1px,
			transparent 1px,
			transparent 2px
		);
		opacity: 0.4;
	}

	/* Floating Eyes */
	.eyes-bg {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 0;
	}

	.floating-eye {
		position: absolute;
		color: var(--accent);
		animation: drift 20s ease-in-out infinite;
	}

	@keyframes drift {
		0%, 100% { transform: translate(0, 0) scale(1); }
		25% { transform: translate(10px, -15px) scale(1.1); }
		50% { transform: translate(-5px, 10px) scale(0.95); }
		75% { transform: translate(15px, 5px) scale(1.05); }
	}

	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem 3rem;
		position: relative;
		z-index: 1;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* Header */
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--border);
	}

	.logo-group {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.logo-eye {
		font-size: 1.75rem;
		color: var(--accent);
		animation: glow-pulse 3s ease-in-out infinite;
	}

	@keyframes glow-pulse {
		0%, 100% {
			text-shadow: 0 0 10px var(--accent-glow), 0 0 30px var(--accent-glow);
			opacity: 1;
		}
		50% {
			text-shadow: 0 0 20px var(--accent), 0 0 50px var(--accent-glow);
			opacity: 0.85;
		}
	}

	.logo {
		font-family: 'Instrument Serif', Georgia, serif;
		font-size: 2rem;
		font-weight: 400;
		letter-spacing: 0.25em;
		margin: 0;
		background: linear-gradient(135deg, var(--text) 0%, var(--accent) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.nav {
		display: flex;
		gap: 0.5rem;
	}

	.nav-link {
		padding: 0.5rem 1rem;
		color: var(--text-dim);
		text-decoration: none;
		font-size: 0.8rem;
		letter-spacing: 0.05em;
		border: 1px solid transparent;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.nav-link:hover {
		color: var(--accent);
		border-color: var(--border-light);
		background: var(--bg-card);
	}

	/* Main */
	.main {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4rem;
		padding: 3rem 0;
		align-items: center;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	/* Hero */
	.tagline {
		font-size: 0.7rem;
		letter-spacing: 0.35em;
		color: var(--accent);
		margin: 0;
		font-weight: 600;
	}

	.headline {
		font-family: 'Instrument Serif', Georgia, serif;
		font-size: 3rem;
		font-weight: 400;
		line-height: 1.15;
		margin: 0.75rem 0;
		letter-spacing: -0.01em;
	}

	.description {
		font-size: 0.875rem;
		color: var(--text-dim);
		line-height: 1.7;
		margin: 0;
		max-width: 440px;
	}

	/* Terminal */
	.terminal {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
	}

	.terminal-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0.75rem 1rem;
		background: rgba(255,255,255,0.02);
		border-bottom: 1px solid var(--border);
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.dot-red { background: #ff5f57; }
	.dot-yellow { background: #febc2e; }
	.dot-green { background: #28c840; }

	.terminal-title {
		margin-left: 8px;
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.terminal-body {
		padding: 1rem;
		font-size: 0.8rem;
		line-height: 1.8;
	}

	.terminal-body p { margin: 0; }
	.prompt { color: var(--success); }
	.output { color: var(--text-dim); }
	.hl { color: var(--accent); font-weight: 600; }
	.hl.alert { color: var(--alert); }
	.hl.success { color: var(--success); }

	.cursor {
		animation: blink 1s step-end infinite;
		color: var(--accent);
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}

	/* Stats */
	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
	}

	.stat {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		transition: all 0.2s;
	}

	.stat:hover {
		border-color: var(--border-light);
		box-shadow: 0 0 20px rgba(245, 158, 11, 0.05);
	}

	.stat-alert:hover {
		border-color: rgba(239, 68, 68, 0.3);
	}

	.stat-icon {
		font-size: 1.25rem;
		color: var(--accent);
	}

	.stat-alert .stat-icon { color: var(--alert); }

	.stat-data {
		display: flex;
		flex-direction: column;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
	}

	.stat-label {
		font-size: 0.65rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	/* Alerts Section */
	.alerts-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-head h3 {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0;
	}

	.link {
		font-size: 0.7rem;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.2s;
	}

	.link:hover { color: var(--accent); }

	.alerts-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.alert-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 6px;
		text-decoration: none;
		color: var(--text);
		transition: all 0.2s;
	}

	.alert-item:hover {
		border-color: var(--border-light);
		background: var(--bg-hover);
	}

	.alert-severity {
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		color: white;
	}

	.alert-title {
		flex: 1;
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.alert-time {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	/* Agent Control */
	.agent-control {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.agent-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.8rem;
		color: var(--text-dim);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-dot.running {
		background: var(--success);
		box-shadow: 0 0 10px var(--success);
		animation: pulse-dot 2s infinite;
	}

	.status-dot.idle {
		background: var(--text-muted);
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid var(--border-light);
		border-radius: 4px;
		color: var(--text-dim);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:hover {
		border-color: var(--accent);
		color: var(--accent);
		box-shadow: 0 0 15px var(--accent-glow);
	}

	/* Quote */
	.quote {
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.quote p {
		font-family: 'Instrument Serif', Georgia, serif;
		font-style: italic;
		font-size: 0.9rem;
		color: var(--text-dim);
		line-height: 1.6;
		margin: 0 0 0.5rem;
	}

	.quote cite {
		font-size: 0.7rem;
		color: var(--text-muted);
		font-style: normal;
	}

	/* ASCII Art */
	.ascii-side {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.ascii-art {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.55rem;
		line-height: 1.15;
		color: var(--text-muted);
		white-space: pre;
		margin: 0;
		opacity: 0.5;
		text-shadow: 0 0 30px var(--accent-glow);
		animation: ascii-breathe 6s ease-in-out infinite;
	}

	@keyframes ascii-breathe {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 0.6; }
	}

	/* Responsive */
	@media (max-width: 1100px) {
		.main {
			grid-template-columns: 1fr;
		}

		.ascii-side {
			display: none;
		}

		.stats {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 640px) {
		.container {
			padding: 1.5rem;
		}

		.header {
			flex-direction: column;
			gap: 1rem;
		}

		.headline {
			font-size: 2rem;
		}

		.stats {
			grid-template-columns: 1fr 1fr;
		}

		.nav {
			width: 100%;
			justify-content: center;
		}
	}
</style>
