import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import {
  type GammaEvent,
  type GammaMarket,
  gammaClient,
} from "@/lib/server/polymarket/gamma";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Extract candidate name from market question or slug
 */
function extractCandidateName(market: GammaMarket): string {
  if (market.question) {
    // Clean the question - remove trailing numbers that aren't years (like IDs)
    const cleanedQuestion = market.question
      .replace(/\s+\d{2,6}\s+\d{2,6}$/i, "") // Remove trailing number pairs like "344 142"
      .replace(/\s+\d{6,}$/i, "") // Remove trailing long numbers
      .trim();

    const willMatch = cleanedQuestion.match(
      /^Will\s+(.+?)\s+(win|become|be)\b/i,
    );
    if (willMatch) {
      return willMatch[1].trim();
    }
    const toMatch = cleanedQuestion.match(/^(.+?)\s+to\s+(win|become|be)\b/i);
    if (toMatch) {
      return toMatch[1].trim();
    }

    // For questions that don't match patterns, just return the cleaned question
    return cleanedQuestion;
  }

  if (market.slug) {
    const cleaned = market.slug
      .replace(/-wins?-.*$/i, "")
      .replace(/-2028.*$/i, "")
      .replace(/-presidential.*$/i, "")
      .replace(/-nominee.*$/i, "")
      .replace(/-/g, " ");

    return cleaned
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return "Unknown";
}

/**
 * Check if a market is a placeholder
 */
function isPlaceholderMarket(market: GammaMarket): boolean {
  if (!market.question) return false;
  const q = market.question.toLowerCase();
  return (
    /\bperson\s+[a-z]{1,2}\b/i.test(market.question) ||
    q.includes("another person")
  );
}

/**
 * Convert Gamma event to our Convex market format
 */
function convertEventToConvexMarket(event: GammaEvent) {
  const realMarkets = event.markets.filter((m) => !isPlaceholderMarket(m));

  const outcomes = realMarkets.map((market) => {
    let price = 0;
    try {
      // outcomePrices is a JSON string like "[\"0.18\", \"0.82\"]", need to parse it
      let prices: string[] = [];
      if (typeof market.outcomePrices === "string") {
        prices = JSON.parse(market.outcomePrices);
      } else if (Array.isArray(market.outcomePrices)) {
        prices = market.outcomePrices;
      }

      const priceStr = prices[0];
      if (priceStr && priceStr.trim() !== "") {
        const parsed = parseFloat(priceStr);
        // Only use if it's a valid number between 0 and 1
        if (
          !Number.isNaN(parsed) &&
          Number.isFinite(parsed) &&
          parsed >= 0 &&
          parsed <= 1
        ) {
          price = parsed;
        }
      }
    } catch (e) {
      console.log(`[Sync] Failed to parse price for market ${market.slug}:`, e);
    }

    const name = extractCandidateName(market);

    return {
      name,
      tokenId: market.conditionId,
      price,
    };
  });

  outcomes.sort((a, b) => b.price - a.price);

  return {
    polymarketId: event.id,
    slug: event.slug,
    question: event.title,
    category: "politics",
    endDate: event.endDate ? new Date(event.endDate).getTime() : undefined,
    isActive: event.active,
    totalVolume: event.volume,
    outcomes: outcomes.slice(0, 5),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 10;
    const clear = body.clear !== false;

    console.log(`[Sync] Fetching top ${limit} political events...`);

    if (clear) {
      console.log("[Sync] Clearing existing markets...");
      const result = await convex.mutation(api.markets.deleteAll, {});
      console.log(`[Sync] Deleted ${result.deleted} old markets`);
    }

    const events = (await (gammaClient as any).getTopPoliticalEvents(
      limit,
    )) as GammaEvent[];

    console.log(`[Sync] Found ${events.length} political events`);

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
          const message =
            error instanceof Error ? error.message : "Unknown error";
          return {
            slug: event.slug,
            title: event.title,
            success: false,
            error: message,
          };
        }
      }),
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      synced: successful,
      failed,
      events: results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Sync] Error:", message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const events = (await (gammaClient as any).getTopPoliticalEvents(
      10,
    )) as GammaEvent[];

    return NextResponse.json({
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
