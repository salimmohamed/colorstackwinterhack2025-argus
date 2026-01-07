<script lang="ts">
	import type { Snippet } from "svelte";
	import { PUBLIC_CONVEX_URL } from "$env/static/public";
	import { setupConvex } from "convex-svelte";

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	setupConvex(PUBLIC_CONVEX_URL);
</script>

<svelte:head>
	<title>Poly Insider Detector</title>
</svelte:head>

<div class="app">
	<header>
		<nav>
			<a href="/" class="logo">Poly Insider Detector</a>
			<div class="nav-links">
				<a href="/">Dashboard</a>
				<a href="/alerts">Alerts</a>
				<a href="/accounts">Accounts</a>
				<a href="/markets">Markets</a>
			</div>
		</nav>
	</header>

	<main>
		{@render children()}
	</main>

	<footer>
		<p>Polymarket Insider Trading Detection Agent</p>
	</footer>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			"Segoe UI",
			Roboto,
			sans-serif;
	}

	header {
		background: #1a1a2e;
		color: white;
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
		font-size: 1.5rem;
		font-weight: bold;
		color: white;
		text-decoration: none;
	}

	.nav-links {
		display: flex;
		gap: 1.5rem;
	}

	.nav-links a {
		color: #a0a0a0;
		text-decoration: none;
		transition: color 0.2s;
	}

	.nav-links a:hover {
		color: white;
	}

	main {
		flex: 1;
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
	}

	footer {
		background: #f5f5f5;
		padding: 1rem 2rem;
		text-align: center;
		color: #666;
	}
</style>
