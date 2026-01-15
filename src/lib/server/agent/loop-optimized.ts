/**
 * Optimized Agent Loop
 *
 * Key optimizations:
 * 1. Context summarization - don't accumulate full history
 * 2. Sliding window - keep only last 2 tool results
 * 3. Incremental checkpoints - pass between runs
 * 4. Early termination - stop when no suspicious activity found
 */

import type { ContentBlock } from "@aws-sdk/client-bedrock-runtime";
import {
  type BedrockMessage,
  createBedrockClient,
  createToolResultContent,
  isTextBlock,
  isToolUse,
} from "./bedrock";
import {
  clearCaches,
  executeOptimizedTool,
  getCacheStats,
} from "./executor-optimized";
import { SYSTEM_PROMPT_OPTIMIZED } from "./prompt-optimized";
import { agentToolsOptimized } from "./tools-optimized";

export interface OptimizedAgentConfig {
  maxIterations: number;
  maxTokens: number;
  modelId?: string;
  region?: string;
  // Checkpoints for incremental analysis
  checkpoints?: Map<string, number>; // marketId -> lastAnalyzedTimestamp
}

export interface OptimizedAgentResult {
  success: boolean;
  iterations: number;
  flagsCreated: number;
  accountsAnalyzed: number;
  tokensUsed: { input: number; output: number };
  newCheckpoints: Map<string, number>;
  cacheStats: {
    marketContexts: number;
    accounts: number;
    analyzedThisSession: number;
  };
  error?: string;
}

const DEFAULT_CONFIG: OptimizedAgentConfig = {
  maxIterations: 50, // Balanced iteration count
  maxTokens: 2048, // Reduced from 4096
};

/**
 * Summarize conversation state to reduce context
 * Instead of keeping full history, we keep a summary
 */
function summarizeState(
  analyzedAccounts: string[],
  flaggedAccounts: string[],
  currentFindings: string[],
): string {
  return `## Current Session State
Analyzed: ${analyzedAccounts.length} accounts (${analyzedAccounts.slice(-5).join(", ")}${analyzedAccounts.length > 5 ? "..." : ""})
Flagged: ${flaggedAccounts.length} accounts (${flaggedAccounts.join(", ") || "none yet"})
Key findings: ${currentFindings.slice(-3).join("; ") || "none yet"}

Continue investigating or conclude if no more suspicious activity.`;
}

/**
 * Run optimized agent loop
 */
export async function runOptimizedAgentLoop(
  marketIds: string[],
  config: Partial<OptimizedAgentConfig> = {},
): Promise<OptimizedAgentResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const client = createBedrockClient({
    region: cfg.region,
    modelId: cfg.modelId,
  });

  // Clear caches for fresh run (or keep for incremental)
  if (!cfg.checkpoints) {
    clearCaches();
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let flagsCreated = 0;
  const analyzedAccounts: string[] = [];
  const flaggedAccounts: string[] = [];
  const currentFindings: string[] = [];
  const newCheckpoints = new Map<string, number>();

  // Build initial prompt with checkpoints
  const checkpointInfo = cfg.checkpoints
    ? `\nINCREMENTAL MODE: Only analyze trades after these timestamps:\n${[...cfg.checkpoints.entries()].map(([m, t]) => `- ${m}: ${new Date(t).toISOString()}`).join("\n")}`
    : "";

  const taskPrompt = `Analyze these markets for insider trading: ${marketIds.join(", ")}${checkpointInfo}

Start by fetching market activity. Focus on large trades from new/suspicious accounts.
Be efficient - skip accounts you've already analyzed.`;

  // Sliding window: only keep last 2 exchanges
  let recentMessages: BedrockMessage[] = [
    { role: "user", content: [{ text: taskPrompt }] },
  ];

  let iterations = 0;

  try {
    while (iterations < cfg.maxIterations) {
      iterations++;
      console.log(`[OptAgent] Iteration ${iterations}/${cfg.maxIterations}`);

      // If we have findings, add summary to context
      if (iterations > 1) {
        const summary = summarizeState(
          analyzedAccounts,
          flaggedAccounts,
          currentFindings,
        );
        // Prepend summary to first message
        recentMessages[0] = {
          role: "user",
          content: [{ text: `${summary}\n\n${taskPrompt}` }],
        };
      }

      // Keep conversation manageable while preserving complete tool use cycles
      // Bedrock requires: assistant(tool_use) must precede user(tool_result)
      if (recentMessages.length > 7) {
        // Reset to just the initial prompt to avoid tool_use/tool_result mismatches
        // The summary in recentMessages[0] will preserve context
        recentMessages = [recentMessages[0]];
      }

      const response = await client.converse({
        system: SYSTEM_PROMPT_OPTIMIZED,
        messages: recentMessages,
        tools: agentToolsOptimized,
        maxTokens: cfg.maxTokens,
      });

      totalInputTokens += response.usage.inputTokens;
      totalOutputTokens += response.usage.outputTokens;

      // Add assistant response
      recentMessages.push({
        role: "assistant",
        content: response.output.message.content,
      });

      // Log text output
      for (const block of response.output.message.content) {
        if (isTextBlock(block)) {
          const text = block.text.slice(0, 150);
          console.log(`[OptAgent] ${text}...`);
          // Extract findings for summary
          if (
            text.toLowerCase().includes("suspicious") ||
            text.toLowerCase().includes("flag")
          ) {
            currentFindings.push(text.slice(0, 100));
          }
        }
      }

      // Check if done
      if (response.stopReason !== "tool_use") {
        console.log("[OptAgent] No more tool calls - finishing");
        break;
      }

      // Execute tool calls
      const toolUseBlocks = response.output.message.content.filter(isToolUse);
      if (toolUseBlocks.length === 0) break;

      const toolResultContents: ContentBlock[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const toolUse = block.toolUse!;
          console.log(`[OptAgent] Tool: ${toolUse.name}`);

          try {
            const result = await executeOptimizedTool(
              toolUse.name!,
              toolUse.input as Record<string, unknown>,
            );

            // Track state
            if (toolUse.name === "fetch_account_data") {
              analyzedAccounts.push(
                (toolUse.input as any).address?.slice(0, 10) || "?",
              );
            }
            if (toolUse.name === "flag_suspicious_account") {
              flagsCreated++;
              flaggedAccounts.push(
                (toolUse.input as any).address?.slice(0, 10) || "?",
              );
            }
            if (toolUse.name === "fetch_market_activity") {
              const r = result as any;
              if (r.checkpoint) {
                newCheckpoints.set(r.id, r.checkpoint);
              }
            }

            return createToolResultContent(toolUse.toolUseId!, result);
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : "Error";
            return {
              toolResult: {
                toolUseId: toolUse.toolUseId!,
                content: [{ text: `Error: ${errMsg}` }],
                status: "error" as const,
              },
            };
          }
        }),
      );

      recentMessages.push({
        role: "user",
        content: toolResultContents,
      });

      // Early termination: if we've analyzed accounts and found nothing suspicious
      if (
        iterations >= 3 &&
        analyzedAccounts.length >= 3 &&
        flaggedAccounts.length === 0
      ) {
        const lastText = response.output.message.content
          .filter(isTextBlock)
          .map((b) => (b as any).text)
          .join(" ")
          .toLowerCase();

        if (
          lastText.includes("no suspicious") ||
          lastText.includes("appears normal") ||
          lastText.includes("no insider")
        ) {
          console.log(
            "[OptAgent] Early termination - no suspicious activity found",
          );
          break;
        }
      }
    }

    return {
      success: true,
      iterations,
      flagsCreated,
      accountsAnalyzed: analyzedAccounts.length,
      tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
      newCheckpoints,
      cacheStats: getCacheStats(),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[OptAgent] Error:", errMsg);

    return {
      success: false,
      iterations,
      flagsCreated,
      accountsAnalyzed: analyzedAccounts.length,
      tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
      newCheckpoints,
      cacheStats: getCacheStats(),
      error: errMsg,
    };
  }
}

export default runOptimizedAgentLoop;
