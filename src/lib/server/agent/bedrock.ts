/**
 * AWS Bedrock client wrapper for Claude
 * Uses the Converse API for tool use support
 */

import {
	BedrockRuntimeClient,
	ConverseCommand,
	type ContentBlock,
	type Message,
	type ToolConfiguration,
	type ToolResultBlock,
} from "@aws-sdk/client-bedrock-runtime";
// Environment variables accessed via process.env in Next.js
import type { Tool } from "./types";

export interface BedrockConfig {
	region: string;
	modelId?: string;
}

export interface BedrockMessage {
	role: "user" | "assistant";
	content: ContentBlock[];
}

export interface BedrockResponse {
	output: {
		message: {
			role: string;
			content: ContentBlock[];
		};
	};
	stopReason: string;
	usage: {
		inputTokens: number;
		outputTokens: number;
	};
}

/**
 * Convert our tool format to Bedrock's tool configuration
 */
function convertToolsToBedrockFormat(tools: Tool[]): ToolConfiguration {
	return {
		tools: tools.map((tool) => ({
			toolSpec: {
				name: tool.name,
				description: tool.description,
				inputSchema: {
					json: tool.input_schema as Record<string, unknown>,
				},
			},
		})),
	} as ToolConfiguration;
}

/**
 * AWS Bedrock client for Claude
 */
export class BedrockClient {
	private client: BedrockRuntimeClient;
	private modelId: string;

	constructor(config: BedrockConfig) {
		this.client = new BedrockRuntimeClient({
			region: config.region,
			// AWS credentials are automatically loaded from environment or IAM role
		});
		// Use Haiku 3.5 inference profile (4.5 has tight rate limits)
		this.modelId = config.modelId || "us.anthropic.claude-3-5-haiku-20241022-v1:0";
	}

	/**
	 * Send a message to Claude via Bedrock Converse API
	 * Includes retry logic for rate limits
	 */
	async converse(params: {
		system: string;
		messages: BedrockMessage[];
		tools: Tool[];
		maxTokens?: number;
	}): Promise<BedrockResponse> {
		const command = new ConverseCommand({
			modelId: this.modelId,
			system: [{ text: params.system }],
			messages: params.messages as Message[],
			toolConfig: convertToolsToBedrockFormat(params.tools),
			inferenceConfig: {
				maxTokens: params.maxTokens || 4096,
				temperature: 0.7,
			},
		});

		// Retry with exponential backoff for rate limits
		const maxRetries = 3;
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const response = await this.client.send(command);
				return {
					output: {
						message: {
							role: response.output?.message?.role || "assistant",
							content: response.output?.message?.content || [],
						},
					},
					stopReason: response.stopReason || "end_turn",
					usage: {
						inputTokens: response.usage?.inputTokens || 0,
						outputTokens: response.usage?.outputTokens || 0,
					},
				};
			} catch (error: any) {
				lastError = error;
				if (error.name === "ThrottlingException" || error.message?.includes("Too many requests")) {
					const delay = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
					console.log(`[Bedrock] Rate limited, retrying in ${delay/1000}s (attempt ${attempt + 1}/${maxRetries})`);
					await new Promise(r => setTimeout(r, delay));
				} else {
					throw error;
				}
			}
		}

		throw lastError || new Error("Max retries exceeded");
	}
}

/**
 * Create a Bedrock client
 */
export function createBedrockClient(config?: Partial<BedrockConfig>) {
	const region = config?.region || process.env.AWS_REGION || "us-east-1";

	return new BedrockClient({
		region,
		modelId: config?.modelId,
	});
}

/**
 * Helper to create a tool result message
 */
export function createToolResultContent(
	toolUseId: string,
	result: unknown,
): ContentBlock {
	return {
		toolResult: {
			toolUseId,
			content: [{ text: JSON.stringify(result) }],
		} as ToolResultBlock,
	};
}

/**
 * Check if a content block is a tool use request
 */
export function isToolUse(
	block: ContentBlock,
): block is ContentBlock & { toolUse: { toolUseId: string; name: string; input: unknown } } {
	return "toolUse" in block && block.toolUse !== undefined;
}

/**
 * Check if a content block is text
 */
export function isTextBlock(
	block: ContentBlock,
): block is ContentBlock & { text: string } {
	return "text" in block && typeof block.text === "string";
}
