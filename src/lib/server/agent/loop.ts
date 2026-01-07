/**
 * Agent loop - orchestrates the insider trading detection process
 */

import { createFoundryClient } from "./foundry";
import { executeTool } from "./executor";
import { SYSTEM_PROMPT } from "./prompt";
import { agentTools } from "./tools";
import type { ContentBlock, Message, ToolResult, ToolUse } from "./types";

export interface AgentConfig {
	maxIterations: number;
	maxTokens: number;
	model: string;
	apiKey?: string;
	resource?: string;
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
	model: "claude-sonnet-4-5",
};

/**
 * Run the insider trading detection agent on specified markets
 */
export async function runAgentLoop(
	marketIds: string[],
	config: Partial<AgentConfig> = {},
): Promise<AgentRunResult> {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	const client = createFoundryClient({
		apiKey: cfg.apiKey,
		resource: cfg.resource,
		model: cfg.model,
	});

	const toolCallLog: AgentRunResult["toolCalls"] = [];
	let totalInputTokens = 0;
	let totalOutputTokens = 0;

	// Initialize conversation with task
	const taskPrompt = `Begin monitoring cycle for markets: ${marketIds.join(", ")}

Analyze recent activity and investigate any suspicious patterns.
Take autonomous action to flag accounts that show insider trading signals.

Start by fetching market activity for each market, then investigate any large or unusual trades.`;

	const messages: Message[] = [
		{
			role: "user",
			content: taskPrompt,
		},
	];

	let iterations = 0;

	try {
		while (iterations < cfg.maxIterations) {
			iterations++;
			console.log(`[Agent] Iteration ${iterations}/${cfg.maxIterations}`);

			// Call Claude via Foundry
			const response = await client.createMessage({
				model: cfg.model,
				max_tokens: cfg.maxTokens,
				system: SYSTEM_PROMPT,
				tools: agentTools,
				messages,
			});

			totalInputTokens += response.usage.input_tokens;
			totalOutputTokens += response.usage.output_tokens;

			// Add assistant response to history
			messages.push({
				role: "assistant",
				content: response.content,
			});

			// Check if we're done (no tool use)
			const toolUseBlocks = response.content.filter(
				(block): block is ToolUse => block.type === "tool_use",
			);

			if (toolUseBlocks.length === 0) {
				console.log("[Agent] No more tool calls - finishing");
				break;
			}

			// Execute all tool calls
			const toolResults: ToolResult[] = await Promise.all(
				toolUseBlocks.map(async (toolUse) => {
					const startTime = Date.now();
					console.log(`[Agent] Executing tool: ${toolUse.name}`);

					try {
						const result = await executeTool(toolUse.name, toolUse.input);

						toolCallLog.push({
							tool: toolUse.name,
							input: toolUse.input,
							output: result,
							timestamp: startTime,
						});

						return {
							type: "tool_result" as const,
							tool_use_id: toolUse.id,
							content:
								typeof result === "string" ? result : JSON.stringify(result),
						};
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : "Unknown error";

						toolCallLog.push({
							tool: toolUse.name,
							input: toolUse.input,
							output: { error: errorMessage },
							timestamp: startTime,
						});

						return {
							type: "tool_result" as const,
							tool_use_id: toolUse.id,
							content: `Error: ${errorMessage}`,
							is_error: true,
						};
					}
				}),
			);

			// Add tool results to messages
			messages.push({
				role: "user",
				content: toolResults as ContentBlock[],
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
