<script lang="ts">
	import type { Snippet } from "svelte";
	import { PUBLIC_CONVEX_URL } from "$env/static/public";
	import { setupConvex } from "convex-svelte";
	import { page } from "$app/stores";

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	setupConvex(PUBLIC_CONVEX_URL);

	// Check if we're on the home page (landing page gets full-screen treatment)
	$: isLandingPage = $page.url.pathname === "/";
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
</svelte:head>

{#if isLandingPage}
	<!-- Landing page renders without wrapper -->
	{@render children()}
{:else}
	<!-- Internal pages get the app shell -->
	<div class="app">
		<header>
			<nav>
				<a href="/" class="logo">
					<span class="logo-eye">◉</span>
					<span class="logo-text">ARGUS</span>
				</a>
				<div class="nav-links">
					<a href="/markets" class:active={$page.url.pathname === "/markets"}>Markets</a>
					<a href="/alerts" class:active={$page.url.pathname === "/alerts"}>Alerts</a>
					<a href="/accounts" class:active={$page.url.pathname === "/accounts"}>Accounts</a>
				</div>
			</nav>
		</header>

		<main>
			{@render children()}
		</main>

		<footer>
			<p>◉ Argus — The All-Seeing Eye</p>
		</footer>
	</div>
{/if}

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		background: #030303;
		color: #fafafa;
		font-family: 'JetBrains Mono', 'SF Mono', monospace;
		-webkit-font-smoothing: antialiased;
	}

	:global(a) {
		color: inherit;
	}

	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	header {
		background: #0a0a0a;
		border-bottom: 1px solid #1a1a1a;
		padding: 1rem 2rem;
	}

	nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		max-width: 1200px;
		margin: 0 auto;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: #fafafa;
	}

	.logo-eye {
		font-size: 1.25rem;
		color: #f59e0b;
	}

	.logo-text {
		font-family: 'Instrument Serif', Georgia, serif;
		font-size: 1.25rem;
		letter-spacing: 0.2em;
	}

	.nav-links {
		display: flex;
		gap: 0.25rem;
	}

	.nav-links a {
		padding: 0.5rem 1rem;
		color: #888888;
		text-decoration: none;
		font-size: 0.8rem;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.nav-links a:hover {
		color: #f59e0b;
		background: #111111;
	}

	.nav-links a.active {
		color: #f59e0b;
		background: #111111;
	}

	main {
		flex: 1;
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
	}

	footer {
		background: #0a0a0a;
		border-top: 1px solid #1a1a1a;
		padding: 1.5rem 2rem;
		text-align: center;
	}

	footer p {
		margin: 0;
		font-size: 0.75rem;
		color: #444444;
		letter-spacing: 0.1em;
	}
</style>
