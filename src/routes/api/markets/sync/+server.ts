import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { gammaClient, type GammaEvent } from "$lib/server/polymarket/gamma";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { PUBLIC_CONVEX_URL } from "$env/static/public";

const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

/**
 * Convert Gamma event to our Convex market format
 * Events are the main "markets" shown on Polymarket (e.g., "2028 Presidential Election")
 */
function convertEventToConvexMarket(event: GammaEvent) {
	// For events with multiple outcomes, combine them
	const outcomes = event.markets.map((market) => {
		// Parse the outcome prices
		let price = 0.5;
		try {
			const prices = JSON.parse(market.outcomePrices || "[]") as string[];
			price = parseFloat(prices[0] || "0.5");
		} catch {
			// Use default
		}

		// Get the outcome name (usually the question minus the event title)
		const name = market.question?.replace(event.title, "").trim() || market.slug || "Unknown";

		return {
			name: name.replace(/^Will\s+/i, "").replace(/\?$/, ""),
			tokenId: market.conditionId,
			price,
		};
	});

	return {
		polymarketId: event.id,
		slug: event.slug,
		question: event.title,
		category: "politics",
		endDate: event.endDate ? new Date(event.endDate).getTime() : undefined,
		isActive: event.active,
		totalVolume: event.volume,
		outcomes: outcomes.slice(0, 10), // Limit to top 10 outcomes
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const limit = body.limit || 10;
		const clear = body.clear || false;

		console.log(`[Sync] Fetching top ${limit} political events...`);

		// Clear existing markets if requested
		if (clear) {
			console.log("[Sync] Clearing existing markets...");
			const existingMarkets = await convex.query(api.markets.listActive, {});
			for (const market of existingMarkets) {
				// We'd need a delete mutation - for now just skip
			}
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
