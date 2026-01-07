/**
 * Agent loop - orchestrates the insider trading detection process
 * Uses AWS Bedrock with Claude
 */

import {
	createBedrockClient,
	createToolResultContent,
	isToolUse,
	isTextBlock,
	type BedrockMessage,
} from "./bedrock";
import { executeTool } from "./executor";
import { SYSTEM_PROMPT } from "./prompt";
import { agentTools } from "./tools";
import type { ContentBlock } from "@aws-sdk/client-bedrock-runtime";

export interface AgentConfig {
	maxIterations: number;
	maxTokens: number;
	modelId?: string;
	region?: string;
}

export interface AgentRunResult {
	success: boolean;
	iterations: number;
	toolCalls: Array<{
		tool: string;
		input: unknown;
		output: unknown;
		timestamp: number;
	}>;
	tokensUsed: {
		input: number;
		output: number;
	};
	error?: string;
}

const DEFAULT_CONFIG: AgentConfig = {
	maxIterations: 20,
	maxTokens: 4096,
};

/**
 * Run the insider trading detection agent on specified markets
 */
export async function runAgentLoop(
	marketIds: string[],
	config: Partial<AgentConfig> = {},
): Promise<AgentRunResult> {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	const client = createBedrockClient({
		region: cfg.region,
		modelId: cfg.modelId,
	});

	const toolCallLog: AgentRunResult["toolCalls"] = [];
	let totalInputTokens = 0;
	let totalOutputTokens = 0;

	// Initialize conversation with task
	const taskPrompt = `Begin monitoring cycle for markets: ${marketIds.join(", ")}

Analyze recent activity and investigate any suspicious patterns.
Take autonomous action to flag accounts that show insider trading signals.

Start by fetching market activity for each market, then investigate any large or unusual trades.`;

	const messages: BedrockMessage[] = [
		{
			role: "user",
			content: [{ text: taskPrompt }],
		},
	];

	let iterations = 0;

	try {
		while (iterations < cfg.maxIterations) {
			iterations++;
			console.log(`[Agent] Iteration ${iterations}/${cfg.maxIterations}`);

			// Call Claude via Bedrock
			const response = await client.converse({
				system: SYSTEM_PROMPT,
				messages,
				tools: agentTools,
				maxTokens: cfg.maxTokens,
			});

			totalInputTokens += response.usage.inputTokens;
			totalOutputTokens += response.usage.outputTokens;

			// Add assistant response to history
			messages.push({
				role: "assistant",
				content: response.output.message.content,
			});

			// Log any text output
			for (const block of response.output.message.content) {
				if (isTextBlock(block)) {
					console.log(`[Agent] ${block.text.slice(0, 200)}...`);
				}
			}

			// Check if we're done (no tool use)
			if (response.stopReason !== "tool_use") {
				console.log("[Agent] No more tool calls - finishing");
				break;
			}

			// Find tool use blocks
			const toolUseBlocks = response.output.message.content.filter(isToolUse);

			if (toolUseBlocks.length === 0) {
				console.log("[Agent] Stop reason was tool_use but no tools found - finishing");
				break;
			}

			// Execute all tool calls and collect results
			const toolResultContents: ContentBlock[] = await Promise.all(
				toolUseBlocks.map(async (block) => {
					const toolUse = block.toolUse!;
					const startTime = Date.now();
					console.log(`[Agent] Executing tool: ${toolUse.name}`);

					try {
						const result = await executeTool(
							toolUse.name!,
							toolUse.input as Record<string, unknown>,
						);

						toolCallLog.push({
							tool: toolUse.name!,
							input: toolUse.input,
							output: result,
							timestamp: startTime,
						});

						return createToolResultContent(toolUse.toolUseId!, result);
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : "Unknown error";

						toolCallLog.push({
							tool: toolUse.name!,
							input: toolUse.input,
							output: { error: errorMessage },
							timestamp: startTime,
						});

						return {
							toolResult: {
								toolUseId: toolUse.toolUseId!,
								content: [{ text: `Error: ${errorMessage}` }],
								status: "error" as const,
							},
						};
					}
				}),
			);

			// Add tool results as user message
			messages.push({
				role: "user",
				content: toolResultContents,
			});
		}

		return {
			success: true,
			iterations,
			toolCalls: toolCallLog,
			tokensUsed: {
				input: totalInputTokens,
				output: totalOutputTokens,
			},
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error("[Agent] Error:", errorMessage);

		return {
			success: false,
			iterations,
			toolCalls: toolCallLog,
			tokensUsed: {
				input: totalInputTokens,
				output: totalOutputTokens,
			},
			error: errorMessage,
		};
	}
}

/**
 * Run agent on 2028 Presidential Election markets
 */
export async function runElection2028Monitoring(
	config?: Partial<AgentConfig>,
): Promise<AgentRunResult> {
	// In production, we'd fetch actual market IDs from Convex or Polymarket API
	const marketIds = ["2028-presidential-election", "who-will-win-2028"];

	return runAgentLoop(marketIds, config);
}

export default runAgentLoop;
