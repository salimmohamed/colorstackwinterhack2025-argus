<script lang="ts">
	import { useQuery } from "convex-svelte";
	import { api } from "../../convex/_generated/api.js";
	import { onMount } from "svelte";

	const marketsQuery = useQuery(api.markets.listActive, () => ({}));

	// Optimized: 130x100 grid, rendered as plain text (no per-char spans)
	const WIDTH = 130;
	const HEIGHT = 100;

	const CHARS = [' ', ' ', '·', '∙', '○', '◐', '●', '◉'];

	function generateEyeText(): string {
		// Return grid of spaces to maintain container size for iris-glow
		let result = '';
		for (let y = 0; y < HEIGHT; y++) {
			result += ' '.repeat(WIDTH) + '\n';
		}
		return result;
	}

	let eyeText = '';
	let mounted = false;

	onMount(() => {
		eyeText = generateEyeText();
		mounted = true;
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
	<title>Argus — The All-Seeing Eye</title>
</svelte:head>

<div class="page">
	<!-- Background Eye System -->
	<div class="eye-system" aria-hidden="true">
		<!-- Base eye layer (grayscale) -->
		<div class="eye-container">
			{#if mounted}
				<pre class="eye-text">{eyeText}</pre>
			{/if}
			<!-- Iris color overlay - positioned via CSS -->
			<div class="iris-glow"></div>
		</div>

		<!-- Eyelids for blink animation -->
		<div class="eyelid eyelid-top"></div>
		<div class="eyelid eyelid-bottom"></div>
	</div>

	<!-- Depth overlays -->
	<div class="overlay-fade"></div>
	<div class="noise"></div>

	<!-- Content -->
	<div class="content">
		<header>
			<nav>
				<a href="/markets" class="nav-link">Markets</a>
			</nav>
		</header>

		<main>
			<div class="hero">
				<p class="eyebrow">POLYMARKET SURVEILLANCE</p>
				<h1 class="wordmark">ARGUS</h1>
				<p class="tagline">The All-Seeing Eye</p>
				<p class="description">
					Autonomous detection of insider trading patterns
					across political prediction markets. Some eyes sleep
					while others watch.
				</p>
			</div>

			<div class="stats">
				<div class="stat">
					<span class="stat-value">
						{#if marketsQuery.isLoading}
							<span class="loading">—</span>
						{:else}
							{marketsQuery.data?.length ?? 0}
						{/if}
					</span>
					<span class="stat-label">Markets Monitored</span>
				</div>
				<div class="stat">
					<span class="stat-value status-active">
						<span class="pulse"></span>
						ACTIVE
					</span>
					<span class="stat-label">Detection Status</span>
				</div>
			</div>

			<a href="/markets" class="cta">
				View Monitored Markets
				<span class="arrow">→</span>
			</a>
		</main>

		<footer>
			<p class="quote">"He had a hundred eyes, of which only two would sleep at a time."</p>
			<p class="attribution">— Ovid</p>
		</footer>
	</div>
</div>

<style>
	:root {
		--bg: #030303;
		--text: #e8e8e8;
		--text-dim: #666;
		--text-muted: #333;
		--accent: #f59e0b;
		--accent-glow: rgba(245, 158, 11, 0.4);
	}

	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		background: var(--bg);
		color: var(--text);
		font-family: 'JetBrains Mono', monospace;
		-webkit-font-smoothing: antialiased;
		overflow-x: hidden;
	}

	.page {
		min-height: 100vh;
		position: relative;
		overflow: hidden;
	}

	/* ===== EYE SYSTEM ===== */
	.eye-system {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
		pointer-events: none;
	}

	.eye-container {
		position: relative;
		opacity: 0.15;
		animation: eye-look 12s ease-in-out infinite;
	}

	@keyframes eye-look {
		0%, 100% {
			transform: translate(0, 0) scale(1);
		}
		20% {
			transform: translate(15px, -8px) scale(1.01);
		}
		40% {
			transform: translate(-10px, 5px) scale(0.99);
		}
		60% {
			transform: translate(8px, 10px) scale(1);
		}
		80% {
			transform: translate(-12px, -5px) scale(1.01);
		}
	}

	.eye-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: clamp(0.32rem, 0.85vw, 0.6rem);
		line-height: 1.0;
		letter-spacing: 0.02em;
		color: #444;
		white-space: pre;
		user-select: none;
	}

	/* Iris glow - radial gradient overlay */
	.iris-glow {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 25%;
		height: 50%;
		transform: translate(-50%, -50%);
		background: radial-gradient(
			ellipse 100% 100% at 50% 50%,
			var(--accent-glow) 0%,
			var(--accent-glow) 30%,
			transparent 70%
		);
		filter: blur(8px);
		mix-blend-mode: screen;
		animation: iris-pulse 4s ease-in-out infinite;
	}

	@keyframes iris-pulse {
		0%, 100% {
			opacity: 0.6;
			transform: translate(-50%, -50%) scale(1);
		}
		50% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1.1);
		}
	}

	/* Eyelids for blinking */
	.eyelid {
		position: absolute;
		left: 0;
		right: 0;
		height: 50%;
		background: var(--bg);
		z-index: 2;
	}

	.eyelid-top {
		top: 0;
		transform-origin: top center;
		animation: blink-top 6s ease-in-out infinite;
	}

	.eyelid-bottom {
		bottom: 0;
		transform-origin: bottom center;
		animation: blink-bottom 6s ease-in-out infinite;
	}

	@keyframes blink-top {
		0%, 42%, 48%, 100% {
			transform: scaleY(0);
		}
		45% {
			transform: scaleY(1);
		}
	}

	@keyframes blink-bottom {
		0%, 42%, 48%, 100% {
			transform: scaleY(0);
		}
		45% {
			transform: scaleY(1);
		}
	}

	/* ===== OVERLAYS ===== */
	.overlay-fade {
		position: fixed;
		inset: 0;
		z-index: 3;
		pointer-events: none;
		background: radial-gradient(
			ellipse 70% 60% at 50% 50%,
			transparent 0%,
			transparent 30%,
			rgba(3, 3, 3, 0.7) 60%,
			var(--bg) 100%
		);
	}

	.noise {
		position: fixed;
		inset: 0;
		z-index: 4;
		pointer-events: none;
		opacity: 0.04;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
	}

	/* ===== CONTENT ===== */
	.content {
		position: relative;
		z-index: 10;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding: 3rem 4rem;
		max-width: 560px;
	}

	header {
		margin-bottom: 2rem;
	}

	.nav-link {
		color: var(--text-dim);
		text-decoration: none;
		font-size: 0.75rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		padding: 0.5rem 0;
		border-bottom: 1px solid transparent;
		transition: all 0.3s;
	}

	.nav-link:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2.5rem;
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.eyebrow {
		font-size: 0.6rem;
		letter-spacing: 0.35em;
		color: var(--text-muted);
	}

	.wordmark {
		font-family: 'Instrument Serif', Georgia, serif;
		font-size: clamp(3.5rem, 14vw, 6.5rem);
		font-weight: 400;
		letter-spacing: 0.02em;
		line-height: 0.85;
	}

	.tagline {
		font-family: 'Instrument Serif', Georgia, serif;
		font-style: italic;
		font-size: 1.2rem;
		color: var(--accent);
		margin-top: 0.5rem;
	}

	.description {
		font-size: 0.85rem;
		line-height: 1.75;
		color: var(--text-dim);
		max-width: 320px;
		margin-top: 0.75rem;
	}

	.stats {
		display: flex;
		gap: 2.5rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.stat-value {
		font-size: 1.4rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.stat-value.status-active {
		color: var(--accent);
		font-size: 0.8rem;
		letter-spacing: 0.1em;
	}

	.pulse {
		width: 8px;
		height: 8px;
		background: var(--accent);
		border-radius: 50%;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
		50% { box-shadow: 0 0 0 8px transparent; }
	}

	.stat-label {
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.loading {
		animation: fade 1s infinite;
	}

	@keyframes fade {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.cta {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--text);
		text-decoration: none;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		padding: 0.8rem 0;
		border-top: 1px solid var(--text-muted);
		border-bottom: 1px solid var(--text-muted);
		transition: all 0.3s;
		width: fit-content;
	}

	.cta:hover {
		color: var(--accent);
		border-color: var(--accent);
		padding-left: 0.6rem;
	}

	.cta:hover .arrow {
		transform: translateX(4px);
	}

	.arrow {
		transition: transform 0.3s;
	}

	footer {
		padding-top: 2rem;
	}

	.quote {
		font-family: 'Instrument Serif', Georgia, serif;
		font-style: italic;
		font-size: 0.85rem;
		color: var(--text-dim);
		line-height: 1.5;
	}

	.attribution {
		font-size: 0.65rem;
		color: var(--text-muted);
		margin-top: 0.4rem;
		letter-spacing: 0.08em;
	}

	/* ===== RESPONSIVE ===== */
	@media (max-width: 768px) {
		.content {
			padding: 2rem;
			max-width: none;
		}
		.wordmark {
			font-size: 3rem;
		}
		.stats {
			flex-direction: column;
			gap: 1.25rem;
		}
		.eye-container {
			opacity: 0.1;
		}
	}

	@media (max-width: 480px) {
		.content {
			padding: 1.5rem;
		}
		.wordmark {
			font-size: 2.5rem;
		}
	}
</style>
