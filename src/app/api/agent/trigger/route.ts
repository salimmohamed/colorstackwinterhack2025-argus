import { NextRequest, NextResponse } from "next/server";
import { runAgentLoop } from "@/lib/server/agent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const marketIds = body.marketIds || ["2028-presidential-election"];

    console.log("[API] Triggering agent for markets:", marketIds);

    const result = await runAgentLoop(marketIds, {
      maxIterations: body.maxIterations || 10,
    });

    return NextResponse.json({
      success: result.success,
      iterations: result.iterations,
      toolCalls: result.toolCalls.length,
      tokensUsed: result.tokensUsed,
      error: result.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[API] Agent trigger failed:", message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ready",
    message: "POST to this endpoint to trigger agent run",
    example: {
      marketIds: ["2028-presidential-election"],
      maxIterations: 10,
    },
  });
}
