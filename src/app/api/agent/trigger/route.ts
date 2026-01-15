import { type NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { runAgentLoop, runOptimizedAgentLoop } from "@/lib/server/agent";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // If no marketIds provided, fetch all active markets from DB
    let marketIds: string[] = body.marketIds;
    if (!marketIds || marketIds.length === 0) {
      const markets = await convex.query(api.markets.listActive, {});
      marketIds = markets.map((m) => m.slug);
      console.log(`[API] No marketIds provided, fetched ${marketIds.length} active markets from DB`);
    }
    const useOptimized = body.optimized !== false; // Default to optimized

    console.log(
      `[API] Triggering ${useOptimized ? "optimized" : "full"} agent for markets:`,
      marketIds,
    );

    if (useOptimized) {
      // Use cost-optimized agent
      const checkpoints = body.checkpoints
        ? new Map(Object.entries(body.checkpoints))
        : undefined;

      const result = await runOptimizedAgentLoop(marketIds, {
        maxIterations: body.maxIterations || 100,
        checkpoints: checkpoints as Map<string, number> | undefined,
      });

      return NextResponse.json({
        success: result.success,
        iterations: result.iterations,
        flagsCreated: result.flagsCreated,
        accountsAnalyzed: result.accountsAnalyzed,
        tokensUsed: result.tokensUsed,
        checkpoints: Object.fromEntries(result.newCheckpoints),
        cacheStats: result.cacheStats,
        error: result.error,
      });
    } else {
      // Use full agent (more expensive)
      const result = await runAgentLoop(marketIds, {
        maxIterations: body.maxIterations || 100,
      });

      return NextResponse.json({
        success: result.success,
        iterations: result.iterations,
        toolCalls: result.toolCalls.length,
        tokensUsed: result.tokensUsed,
        error: result.error,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[API] Agent trigger failed:", message);

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
    message: "POST to this endpoint to trigger agent run",
    examples: {
      optimized: {
        marketIds: ["2028-presidential-election"],
        optimized: true,
        checkpoints: { "market-id": 1704067200000 },
      },
      full: {
        marketIds: ["2028-presidential-election"],
        optimized: false,
        maxIterations: 20,
      },
    },
  });
}
