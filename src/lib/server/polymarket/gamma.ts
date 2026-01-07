/**
 * Polymarket Gamma API Client
 * Fetches market data from https://gamma-api.polymarket.com
 */

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export interface GammaMarket {
	id: string;
	question: string | null;
	conditionId: string;
	slug: string | null;
	category: string | null;
	description: string | null;
	outcomePrices: string[];
	outcomes: string[];
	volume: string | null;
	volumeNum: number | null;
	volume24hr: number | null;
	liquidity: string | null;
	liquidityNum: number | null;
	endDate: string | null;
	active: boolean | null;
	closed: boolean | null;
	marketMakerAddress: string;
	enableOrderBook: boolean | null;
	orderPriceMinTickSize: number | null;
	tags: Array<{ id: string; label: string }>;
}

export interface GammaMarketResponse {
	data: GammaMarket[];
	next_cursor?: string;
}

export interface GetMarketsParams {
	category?: string;
	closed?: boolean;
	active?: boolean;
	limit?: number;
	offset?: number;
	order?: string;
	ascending?: boolean;
	tag_id?: string;
}

export class GammaClient {
	private baseUrl: string;

	constructor(baseUrl = GAMMA_API_BASE) {
		this.baseUrl = baseUrl;
	}

	async getMarkets(params: GetMarketsParams = {}): Promise<GammaMarket[]> {
		const searchParams = new URLSearchParams();

		if (params.category) searchParams.set("category", params.category);
		if (params.closed !== undefined)
			searchParams.set("closed", String(params.closed));
		if (params.active !== undefined)
			searchParams.set("active", String(params.active));
		if (params.limit) searchParams.set("limit", String(params.limit));
		if (params.offset) searchParams.set("offset", String(params.offset));
		if (params.order) searchParams.set("order", params.order);
		if (params.ascending !== undefined)
			searchParams.set("ascending", String(params.ascending));
		if (params.tag_id) searchParams.set("tag_id", params.tag_id);

		const url = `${this.baseUrl}/markets?${searchParams}`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Gamma API error: ${response.status} ${response.statusText}`);
		}

		return response.json();
	}

	async getMarketBySlug(slug: string): Promise<GammaMarket | null> {
		const url = `${this.baseUrl}/markets/slug/${encodeURIComponent(slug)}`;
		const response = await fetch(url);

		if (response.status === 404) {
			return null;
		}

		if (!response.ok) {
			throw new Error(`Gamma API error: ${response.status} ${response.statusText}`);
		}

		return response.json();
	}

	async getMarketById(conditionId: string): Promise<GammaMarket | null> {
		const url = `${this.baseUrl}/markets/${encodeURIComponent(conditionId)}`;
		const response = await fetch(url);

		if (response.status === 404) {
			return null;
		}

		if (!response.ok) {
			throw new Error(`Gamma API error: ${response.status} ${response.statusText}`);
		}

		return response.json();
	}

	/**
	 * Fetch political markets (elections, politics category)
	 */
	async getPoliticalMarkets(limit = 50): Promise<GammaMarket[]> {
		// Fetch markets from politics category
		const markets = await this.getMarkets({
			category: "politics",
			active: true,
			closed: false,
			limit,
			order: "volumeNum",
			ascending: false,
		});

		return markets;
	}

	/**
	 * Fetch 2028 Presidential Election markets specifically
	 */
	async get2028ElectionMarkets(): Promise<GammaMarket[]> {
		const allPolitical = await this.getPoliticalMarkets(100);

		// Filter for 2028 election related markets
		return allPolitical.filter(
			(market) =>
				market.question?.toLowerCase().includes("2028") ||
				market.slug?.toLowerCase().includes("2028") ||
				market.description?.toLowerCase().includes("2028 presidential"),
		);
	}
}

// Singleton instance
export const gammaClient = new GammaClient();
