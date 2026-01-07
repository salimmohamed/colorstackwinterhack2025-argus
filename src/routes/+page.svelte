<script lang="ts">
	import { useQuery } from "convex-svelte";
	import { api } from "../../convex/_generated/api.js";
	import { onMount } from "svelte";

	const marketsQuery = useQuery(api.markets.listActive, () => ({}));

	// Halftone eye generation
	let eyeCanvas: string[][] = [];
	const WIDTH = 80;
	const HEIGHT = 50;

	// Characters by density (light to dark)
	const CHARS = [' ', '·', '∙', '○', '◐', '●', '◉'];

	function generateHalftoneEye() {
		const centerX = WIDTH * 0.5;
		const centerY = HEIGHT * 0.5;
		const outerRadius = Math.min(WIDTH, HEIGHT) * 0.45;
		const irisRadius = outerRadius * 0.45;
		const pupilRadius = irisRadius * 0.4;

		const grid: { char: string; isIris: boolean; isPupil: boolean }[][] = [];

		for (let y = 0; y < HEIGHT; y++) {
			const row: { char: string; isIris: boolean; isPupil: boolean }[] = [];
			for (let x = 0; x < WIDTH; x++) {
				const dx = x - centerX;
				const dy = (y - centerY) * 1.8; // Stretch vertically for eye shape
				const dist = Math.sqrt(dx * dx + dy * dy);

				// Eye shape (almond)
				const eyeWidth = outerRadius;
				const eyeHeight = outerRadius * 0.55;
				const eyeShape = (dx * dx) / (eyeWidth * eyeWidth) + (dy * dy) / (eyeHeight * eyeHeight);

				// Distance from center for iris/pupil
				const irisCheck = Math.sqrt((x - centerX) ** 2 + ((y - centerY) * 1.2) ** 2);

				let char = ' ';
				let isIris = false;
				let isPupil = false;

				if (eyeShape <= 1) {
					// Inside eye shape
					if (irisCheck <= pupilRadius) {
						// Pupil - darkest
						isPupil = true;
						char = CHARS[6];
					} else if (irisCheck <= irisRadius) {
						// Iris - gradient
						isIris = true;
						const irisGradient = (irisCheck - pupilRadius) / (irisRadius - pupilRadius);
						const noise = Math.sin(x * 0.8) * Math.cos(y * 0.6) * 0.3;
						const density = Math.max(0, Math.min(1, 0.7 - irisGradient * 0.4 + noise));
						const charIndex = Math.floor(density * (CHARS.length - 1));
						char = CHARS[Math.min(charIndex + 2, CHARS.length - 1)];
					} else {
						// Sclera (white of eye) - light with subtle texture
						const scleraGradient = (irisCheck - irisRadius) / (outerRadius - irisRadius);
						const edgeDarkening = Math.pow(eyeShape, 2) * 3;
						const noise = Math.sin(x * 2) * Math.cos(y * 1.5) * 0.15;
						const density = Math.max(0, Math.min(0.4, edgeDarkening + noise));
						const charIndex = Math.floor(density * (CHARS.length - 1));
						char = CHARS[charIndex];
					}
				} else if (eyeShape <= 1.15) {
					// Eye outline/lashes
					const outlineIntensity = 1 - (eyeShape - 1) / 0.15;
					const charIndex = Math.floor(outlineIntensity * 3);
					char = CHARS[Math.min(charIndex + 1, 3)];
				}

				row.push({ char, isIris, isPupil });
			}
			grid.push(row);
		}

		return grid;
	}

	let eyeGrid: { char: string; isIris: boolean; isPupil: boolean }[][] = [];
	let mounted = false;

	onMount(() => {
		eyeGrid = generateHalftoneEye();
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
	<!-- Noise texture overlay -->
	<div class="noise"></div>

	<div class="layout">
		<!-- Left: Content -->
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

		<!-- Right: Halftone Eye -->
		<div class="eye-container" aria-hidden="true">
			{#if mounted}
				<pre class="halftone-eye">{#each eyeGrid as row}<span class="eye-row">{#each row as cell}<span class={cell.isPupil ? 'pupil' : cell.isIris ? 'iris' : 'sclera'}>{cell.char}</span>{/each}</span>
{/each}</pre>
			{/if}
		</div>
	</div>
</div>

<style>
	:root {
		--bg: #030303;
		--bg-elevated: #0a0a0a;
		--text: #e8e8e8;
		--text-dim: #666666;
		--text-muted: #333333;
		--accent: #f59e0b;
		--accent-dim: #92610d;
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
	}

	/* Noise texture */
	.noise {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 1000;
		opacity: 0.03;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E");
	}

	.layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		min-height: 100vh;
	}

	/* Left content */
	.content {
		display: flex;
		flex-direction: column;
		padding: 3rem 4rem;
		position: relative;
		z-index: 10;
	}

	header {
		margin-bottom: auto;
	}

	nav {
		display: flex;
	}

	.nav-link {
		color: var(--text-dim);
		text-decoration: none;
		font-size: 0.75rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		padding: 0.5rem 0;
		border-bottom: 1px solid transparent;
		transition: all 0.3s ease;
	}

	.nav-link:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	main {
		display: flex;
		flex-direction: column;
		gap: 3rem;
		padding: 4rem 0;
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.eyebrow {
		font-size: 0.65rem;
		letter-spacing: 0.3em;
		color: var(--text-muted);
		font-weight: 500;
	}

	.wordmark {
		font-family: 'Instrument Serif', Georgia, serif;
		font-size: clamp(4rem, 12vw, 8rem);
		font-weight: 400;
		letter-spacing: 0.05em;
		line-height: 0.9;
		background: linear-gradient(
			180deg,
			var(--text) 0%,
			var(--text-dim) 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.tagline {
		font-family: 'Instrument Serif', Georgia, serif;
		font-style: italic;
		font-size: 1.5rem;
		color: var(--accent);
		margin-top: 0.5rem;
	}

	.description {
		font-size: 0.9rem;
		line-height: 1.8;
		color: var(--text-dim);
		max-width: 380px;
		margin-top: 1rem;
	}

	/* Stats */
	.stats {
		display: flex;
		gap: 3rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.stat-value.status-active {
		color: var(--accent);
		font-size: 0.9rem;
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
		0%, 100% {
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(245, 158, 11, 0);
		}
	}

	.stat-label {
		font-size: 0.65rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.loading {
		animation: fade 1s ease-in-out infinite;
	}

	@keyframes fade {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	/* CTA */
	.cta {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text);
		text-decoration: none;
		font-size: 0.8rem;
		letter-spacing: 0.05em;
		padding: 1rem 0;
		border-top: 1px solid var(--text-muted);
		border-bottom: 1px solid var(--text-muted);
		transition: all 0.3s ease;
		width: fit-content;
	}

	.cta:hover {
		color: var(--accent);
		border-color: var(--accent);
		padding-left: 1rem;
	}

	.arrow {
		transition: transform 0.3s ease;
	}

	.cta:hover .arrow {
		transform: translateX(4px);
	}

	/* Footer */
	footer {
		margin-top: auto;
		padding-top: 2rem;
	}

	.quote {
		font-family: 'Instrument Serif', Georgia, serif;
		font-style: italic;
		font-size: 0.9rem;
		color: var(--text-dim);
		line-height: 1.6;
	}

	.attribution {
		font-size: 0.7rem;
		color: var(--text-muted);
		margin-top: 0.5rem;
		letter-spacing: 0.1em;
	}

	/* Halftone Eye */
	.eye-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		overflow: hidden;
		padding-left: 2rem;
	}

	.halftone-eye {
		font-family: 'JetBrains Mono', monospace;
		font-size: clamp(0.35rem, 0.9vw, 0.55rem);
		line-height: 1.1;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		white-space: pre;
		user-select: none;
		animation: eye-breathe 8s ease-in-out infinite;
	}

	@keyframes eye-breathe {
		0%, 100% {
			opacity: 0.8;
			filter: blur(0px);
		}
		50% {
			opacity: 1;
			filter: blur(0.3px);
		}
	}

	.eye-row {
		display: block;
	}

	.sclera {
		color: #444;
	}

	.iris {
		color: var(--accent);
		text-shadow: 0 0 20px rgba(245, 158, 11, 0.3);
		animation: iris-glow 4s ease-in-out infinite;
	}

	@keyframes iris-glow {
		0%, 100% {
			text-shadow: 0 0 15px rgba(245, 158, 11, 0.2);
		}
		50% {
			text-shadow: 0 0 30px rgba(245, 158, 11, 0.5);
		}
	}

	.pupil {
		color: #111;
		text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.layout {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr auto;
		}

		.eye-container {
			position: absolute;
			inset: 0;
			opacity: 0.15;
			justify-content: center;
			padding: 0;
		}

		.content {
			padding: 2rem;
		}
	}

	@media (max-width: 640px) {
		.wordmark {
			font-size: 3.5rem;
		}

		.stats {
			flex-direction: column;
			gap: 1.5rem;
		}

		.content {
			padding: 1.5rem;
		}
	}
</style>
