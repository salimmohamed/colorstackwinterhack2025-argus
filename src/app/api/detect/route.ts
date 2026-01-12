import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { runOptimizedAgentLoop } from "@/lib/server/agent";
import {
  analyzeMarketForInsiders,
  type InsiderFlag,
  type SuspectedInsider,
} from "@/lib/server/detection/insider-detector";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type DetectionMode = "ai" | "rules" | "both";

function getDetectionMode(): DetectionMode {
  const mode = process.env.DETECTION_MODE?.toLowerCase();
  if (mode === "ai" || mode === "rules" || mode === "both") {
    return mode;
  }
  return "rules"; // Default to rules (doesn't require AWS)
}

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

async function saveSuspect(suspect: SuspectedInsider) {
  const accountId = await convex.mutation(api.accounts.upsert, {
    address: suspect.wallet,
    displayName: suspect.displayName,
    totalTrades: suspect.totalTrades,
    totalVolume: suspect.totalVolume,
    winRate: suspect.winRate,
    riskScore: suspect.riskScore,
    flags: suspect.flags.map((f) => f.type),
  });

  const primaryFlag = suspect.flags.reduce(
    (max, f) => (f.weight > max.weight ? f : max),
    suspect.flags[0],
  );
  const title = primaryFlag
    ? primaryFlag.description
    : `Risk score ${suspect.riskScore}`;
  const description = suspect.evidence
    .map((e) => `${e.description}: ${e.value}`)
    .join(". ");

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

async function runRulesDetection(markets: any[], minRiskScore: number) {
  const results: Array<{
    marketSlug: string;
    suspects: Array<{ wallet: string; riskScore: number }>;
  }> = [];

  for (const market of markets) {
    const conditionId = market.outcomes[0]?.tokenId;
    if (!conditionId) continue;

    try {
      const suspects = await analyzeMarketForInsiders(
        conditionId,
        minRiskScore,
      );
      const savedResults: Array<{ wallet: string; riskScore: number }> = [];

      for (const suspect of suspects) {
        try {
          const result = await saveSuspect(suspect);
          savedResults.push({
            wallet: result.wallet,
            riskScore: result.riskScore,
          });
        } catch (error) {
          console.error(
            `[Detect] Error saving suspect ${suspect.wallet}:`,
            error,
          );
        }
      }

      results.push({ marketSlug: market.slug, suspects: savedResults });
    } catch (error) {
      console.error(`[Detect] Error analyzing market ${market.slug}:`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

async function runAIDetection(marketIds: string[]) {
  try {
    const result = await runOptimizedAgentLoop(marketIds, {
      maxIterations: 15,
    });

    return {
      success: result.success,
      iterations: result.iterations,
      flagsCreated: result.flagsCreated,
      accountsAnalyzed: result.accountsAnalyzed,
      tokensUsed: result.tokensUsed,
      error: result.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const minRiskScore = body.minRiskScore || 30;
    const limitMarkets = body.limitMarkets || 5;

    // Allow override via request body, otherwise use env
    const mode: DetectionMode = body.mode || getDetectionMode();

    console.log(`[Detect] Running detection in "${mode}" mode`);

    // Get active markets
    const markets = await convex.query(api.markets.listActive, {});
    const marketsToAnalyze = markets.slice(0, limitMarkets);
    // Use condition IDs (token IDs) for API calls, not slugs
    const marketIds = marketsToAnalyze
      .map((m) => m.outcomes?.[0]?.tokenId)
      .filter((id): id is string => !!id);

    const response: {
      success: boolean;
      mode: DetectionMode;
      rules?: {
        marketsAnalyzed: number;
        totalSuspects: number;
        results: any[];
      };
      ai?: {
        success: boolean;
        iterations?: number;
        flagsCreated?: number;
        error?: string;
      };
      error?: string;
    } = {
      success: true,
      mode,
    };

    // Run rules-based detection
    if (mode === "rules" || mode === "both") {
      console.log(
        `[Detect] Running rule-based detection on ${marketsToAnalyze.length} markets`,
      );
      const rulesResults = await runRulesDetection(
        marketsToAnalyze,
        minRiskScore,
      );
      const totalSuspects = rulesResults.reduce(
        (sum, r) => sum + r.suspects.length,
        0,
      );

      response.rules = {
        marketsAnalyzed: rulesResults.length,
        totalSuspects,
        results: rulesResults,
      };
    }

    // Run AI detection
    if (mode === "ai" || mode === "both") {
      // Check if AWS credentials are configured (don't expose details in response)
      if (
        !process.env.AWS_ACCESS_KEY_ID ||
        !process.env.AWS_SECRET_ACCESS_KEY
      ) {
        console.warn(
          `[Detect] AI mode requested but AWS credentials not configured`,
        );
        response.ai = {
          success: false,
          error: "AI detection not available",
        };
      } else {
        console.log(
          `[Detect] Running AI agent on markets: ${marketIds.join(", ")}`,
        );
        response.ai = await runAIDetection(marketIds);
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Detect] Error:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function GET() {
  const mode = getDetectionMode();

  return NextResponse.json({
    status: "ready",
    currentMode: mode,
    modes: {
      rules: "Rule-based detection",
      ai: "AI-powered detection",
      both: "Combined detection",
    },
    usage: {
      endpoint: "POST /api/detect",
      body: {
        minRiskScore: "Minimum risk score to flag (default: 30)",
        limitMarkets: "Maximum markets to analyze (default: 5)",
        mode: "Override detection mode for this request (optional)",
      },
    },
  });
}
