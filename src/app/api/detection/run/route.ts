import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import {
  analyzeMarketForInsiders,
  type InsiderFlag,
  type SuspectedInsider,
} from "@/lib/server/detection/insider-detector";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Map insider flag types to schema signal types
 */
function mapFlagToSignalType(
  flag: InsiderFlag,
):
  | "new_account_large_bet"
  | "timing_correlation"
  | "statistical_improbability"
  | "account_obfuscation"
  | "disproportionate_bet"
  | "pattern_match" {
  switch (flag.type) {
    case "FRESH_WALLET":
      return "new_account_large_bet";
    case "HIGH_WIN_RATE":
      return "statistical_improbability";
    case "CONCENTRATED_BETS":
      return "pattern_match";
    case "LARGE_PROFIT":
    case "OVERSIZED_POSITION":
    case "RELATIVE_SIZE":
      return "disproportionate_bet";
    case "MARKET_DOMINANCE":
      return "pattern_match";
    case "SUSPICIOUS_TIMING":
      return "timing_correlation";
    default:
      return "pattern_match";
  }
}

/**
 * Get the highest severity flag from a suspect
 */
function getHighestSeverity(
  flags: InsiderFlag[],
): "low" | "medium" | "high" | "critical" {
  const severityOrder: ("critical" | "high" | "medium" | "low")[] = [
    "critical",
    "high",
    "medium",
    "low",
  ];
  for (const severity of severityOrder) {
    if (flags.some((f) => f.severity === severity)) {
      return severity;
    }
  }
  return "low";
}

/**
 * Create or update account and alert for a suspected insider
 */
async function saveSuspect(suspect: SuspectedInsider, _marketId?: string) {
  // First, upsert the account
  const accountId = await convex.mutation(api.accounts.upsert, {
    address: suspect.wallet,
    displayName: suspect.displayName,
    totalTrades: suspect.totalTrades,
    totalVolume: suspect.totalVolume,
    winRate: suspect.winRate,
    riskScore: suspect.riskScore,
    flags: suspect.flags.map((f) => f.type),
  });

  // Find the primary flag (highest weight)
  const primaryFlag = suspect.flags.reduce(
    (max, f) => (f.weight > max.weight ? f : max),
    suspect.flags[0],
  );

  // Generate title from flags
  const title = primaryFlag
    ? primaryFlag.description
    : `Risk score ${suspect.riskScore}`;

  // Generate description from all evidence
  const description = suspect.evidence
    .map((e) => `${e.description}: ${e.value}`)
    .join(". ");

  // Create the alert
  await convex.mutation(api.alerts.create, {
    accountId,
    marketId: undefined, // TODO: Look up proper Convex market ID if needed
    severity: getHighestSeverity(suspect.flags),
    signalType: mapFlagToSignalType(primaryFlag),
    title,
    description,
    evidence: {
      metrics: {
        riskScore: suspect.riskScore,
        probability: suspect.probability,
        totalProfit: suspect.totalProfit,
        totalVolume: suspect.totalVolume,
        winRate: suspect.winRate,
        accountAgeDays: suspect.accountAgeDays,
        totalTrades: suspect.totalTrades,
        uniqueMarketsTraded: suspect.uniqueMarketsTraded,
      },
      reasoning: suspect.flags.map((f) => f.description).join("; "),
    },
  });

  return { accountId, wallet: suspect.wallet, riskScore: suspect.riskScore };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const minRiskScore = body.minRiskScore || 30;
    const limitMarkets = body.limitMarkets || 5;

    console.log(
      `[Detection] Running detection on ${limitMarkets} markets, min score: ${minRiskScore}`,
    );

    // Get active markets from Convex
    const markets = await convex.query(api.markets.listActive, {});
    const marketsToAnalyze = markets.slice(0, limitMarkets);

    console.log(
      `[Detection] Found ${markets.length} markets, analyzing ${marketsToAnalyze.length}`,
    );

    const allResults: Array<{
      marketSlug: string;
      suspects: Array<{ wallet: string; riskScore: number }>;
    }> = [];

    for (const market of marketsToAnalyze) {
      console.log(`[Detection] Analyzing market: ${market.slug}`);

      // Get the first outcome's tokenId as the conditionId
      const conditionId = market.outcomes[0]?.tokenId;
      if (!conditionId) {
        console.log(
          `[Detection] No conditionId for market ${market.slug}, skipping`,
        );
        continue;
      }

      try {
        const suspects = await analyzeMarketForInsiders(
          conditionId,
          minRiskScore,
        );
        console.log(
          `[Detection] Found ${suspects.length} suspects in ${market.slug}`,
        );

        const savedResults: Array<{ wallet: string; riskScore: number }> = [];

        for (const suspect of suspects) {
          try {
            const result = await saveSuspect(suspect, market._id);
            savedResults.push({
              wallet: result.wallet,
              riskScore: result.riskScore,
            });
          } catch (error) {
            console.error(
              `[Detection] Error saving suspect ${suspect.wallet}:`,
              error,
            );
          }
        }

        allResults.push({
          marketSlug: market.slug,
          suspects: savedResults,
        });
      } catch (error) {
        console.error(
          `[Detection] Error analyzing market ${market.slug}:`,
          error,
        );
      }

      // Small delay between markets to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const totalSuspects = allResults.reduce(
      (sum, r) => sum + r.suspects.length,
      0,
    );

    return NextResponse.json({
      success: true,
      marketsAnalyzed: allResults.length,
      totalSuspects,
      results: allResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Detection] Error:", message);

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
  return NextResponse.json({
    status: "ready",
    message: "POST to this endpoint to run insider detection",
    options: {
      minRiskScore: "Minimum risk score to flag (default: 30)",
      limitMarkets: "Maximum number of markets to analyze (default: 5)",
    },
    example: {
      minRiskScore: 30,
      limitMarkets: 5,
    },
  });
}
