import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { gammaClient, type GammaMarket } from "$lib/server/polymarket/gamma";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { PUBLIC_CONVEX_URL } from "$env/static/public";

const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

/**
 * Convert Gamma market to our Convex format
 */
function convertToConvexMarket(market: GammaMarket) {
	// Parse outcomes and prices
	let outcomes: { name: string; tokenId: string; price: number }[] = [];

	try {
		const outcomeNames = JSON.parse(market.outcomes || "[]") as string[];
		const outcomePrices = JSON.parse(market.outcomePrices || "[]") as string[];

		outcomes = outcomeNames.map((name, i) => ({
			name,
			tokenId: market.conditionId + "-" + i,
			price: parseFloat(outcomePrices[i] || "0"),
		}));
	} catch {
		console.warn(`Failed to parse outcomes for ${market.slug}`);
	}

	return {
		polymarketId: market.conditionId,
		slug: market.slug || market.id,
		question: market.question || "Unknown",
		category: market.category || "politics",
		endDate: market.endDate ? new Date(market.endDate).getTime() : undefined,
		isActive: market.active ?? true,
		totalVolume: market.volumeNum || 0,
		outcomes,
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const searchTerm = body.searchTerm || "2028";
		const limit = body.limit || 20;

		console.log(`[Sync] Fetching markets matching "${searchTerm}"...`);

		// Fetch political markets from Polymarket
		const allMarkets = await gammaClient.getMarkets({
			category: "politics",
			active: true,
			closed: false,
			limit: 100,
			order: "volumeNum",
			ascending: false,
		});

		// Filter for markets matching search term
		const filteredMarkets = allMarkets.filter(
			(market) =>
				market.question?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				market.slug?.toLowerCase().includes(searchTerm.toLowerCase()),
		);

		console.log(`[Sync] Found ${filteredMarkets.length} markets matching "${searchTerm}"`);

		// Take top N by volume
		const marketsToSync = filteredMarkets.slice(0, limit);

		// Sync each market to Convex
		const results = await Promise.all(
			marketsToSync.map(async (market) => {
				try {
					const convexMarket = convertToConvexMarket(market);
					const id = await convex.mutation(api.markets.upsert, convexMarket);
					return { slug: market.slug, success: true, id };
				} catch (error) {
					const message = error instanceof Error ? error.message : "Unknown error";
					return { slug: market.slug, success: false, error: message };
				}
			}),
		);

		const successful = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		return json({
			success: true,
			synced: successful,
			failed,
			markets: results,
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
	return json({
		message: "POST to sync markets from Polymarket",
		example: {
			searchTerm: "2028",
			limit: 20,
		},
	});
};
