import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { gammaClient, type GammaEvent, type GammaMarket } from "$lib/server/polymarket/gamma";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { PUBLIC_CONVEX_URL } from "$env/static/public";

const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

/**
 * Extract candidate name from market question or slug
 * Examples:
 * - "Will JD Vance win the 2028 Presidential Election?" -> "JD Vance"
 * - "jd-vance-wins-2028-presidential" -> "JD Vance"
 */
function extractCandidateName(market: GammaMarket): string {
	// Try to extract from question first
	if (market.question) {
		// Pattern: "Will [NAME] win/become/be..."
		const willMatch = market.question.match(/^Will\s+(.+?)\s+(win|become|be)\b/i);
		if (willMatch) {
			return willMatch[1].trim();
		}
		// Pattern: "[NAME] to win/become..."
		const toMatch = market.question.match(/^(.+?)\s+to\s+(win|become|be)\b/i);
		if (toMatch) {
			return toMatch[1].trim();
		}
	}

	// Try to extract from slug
	if (market.slug) {
		// Remove common suffixes and convert to title case
		const cleaned = market.slug
			.replace(/-wins?-.*$/i, "")
			.replace(/-2028.*$/i, "")
			.replace(/-presidential.*$/i, "")
			.replace(/-nominee.*$/i, "")
			.replace(/-/g, " ");

		// Title case
		return cleaned
			.split(" ")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ");
	}

	return "Unknown";
}

/**
 * Check if a market is a placeholder (e.g., "Person AA", "Person CL", "another person")
 */
function isPlaceholderMarket(market: GammaMarket): boolean {
	if (!market.question) return false;
	const q = market.question.toLowerCase();
	// Pattern: "Person" followed by 1-2 uppercase letters, or "another person"
	return /\bperson\s+[a-z]{1,2}\b/i.test(market.question) || q.includes("another person");
}

/**
 * Convert Gamma event to our Convex market format
 * Events are the main "markets" shown on Polymarket (e.g., "2028 Presidential Election")
 */
function convertEventToConvexMarket(event: GammaEvent) {
	// Filter out placeholder markets first
	const realMarkets = event.markets.filter((m) => !isPlaceholderMarket(m));

	// For events with multiple outcomes, combine them
	const outcomes = realMarkets.map((market) => {
		// Parse the outcome prices - first price is typically "Yes" probability
		let price = 0.5;
		try {
			const prices = JSON.parse(market.outcomePrices || "[]") as string[];
			price = parseFloat(prices[0] || "0.5");
		} catch {
			// Use default
		}

		// Extract the candidate/outcome name properly
		const name = extractCandidateName(market);

		return {
			name,
			tokenId: market.conditionId,
			price,
		};
	});

	// Sort outcomes by price (probability) descending
	outcomes.sort((a, b) => b.price - a.price);

	return {
		polymarketId: event.id,
		slug: event.slug,
		question: event.title,
		category: "politics",
		endDate: event.endDate ? new Date(event.endDate).getTime() : undefined,
		isActive: event.active,
		totalVolume: event.volume,
		outcomes: outcomes.slice(0, 5), // Limit to top 5 outcomes
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const limit = body.limit || 10;
		const clear = body.clear !== false; // Default to true - always clear old data

		console.log(`[Sync] Fetching top ${limit} political events...`);

		// Clear existing markets first (enabled by default)
		if (clear) {
			console.log("[Sync] Clearing existing markets...");
			const result = await convex.mutation(api.markets.deleteAll, {});
			console.log(`[Sync] Deleted ${result.deleted} old markets`);
		}

		// Fetch top political events from Polymarket
		const events = (await (gammaClient as any).getTopPoliticalEvents(limit)) as GammaEvent[];

		console.log(`[Sync] Found ${events.length} political events`);

		// Sync each event as a market to Convex
		const results = await Promise.all(
			events.map(async (event) => {
				try {
					const convexMarket = convertEventToConvexMarket(event);
					const id = await convex.mutation(api.markets.upsert, convexMarket);
					return {
						slug: event.slug,
						title: event.title,
						volume: `$${(event.volume / 1000000).toFixed(1)}M`,
						success: true,
						id,
					};
				} catch (error) {
					const message = error instanceof Error ? error.message : "Unknown error";
					return { slug: event.slug, title: event.title, success: false, error: message };
				}
			}),
		);

		const successful = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		return json({
			success: true,
			synced: successful,
			failed,
			events: results,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error("[Sync] Error:", message);

		return json(
			{
				success: false,
				error: message,
			},
			{ status: 500 },
		);
	}
};

export const GET: RequestHandler = async () => {
	// Preview what would be synced
	try {
		const events = (await (gammaClient as any).getTopPoliticalEvents(10)) as GammaEvent[];

		return json({
			message: "Top political events that would be synced",
			events: events.map((e) => ({
				slug: e.slug,
				title: e.title,
				volume: `$${(e.volume / 1000000).toFixed(1)}M`,
				markets: e.markets.length,
			})),
			usage: "POST to this endpoint to sync these events to Convex",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return json({ error: message }, { status: 500 });
	}
};
