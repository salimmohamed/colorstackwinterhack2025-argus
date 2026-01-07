/**
 * Microsoft Foundry SDK client wrapper
 * Provides access to Claude models via Azure
 *
 * NOTE: This is a mock implementation for development.
 * In production, use @anthropic-ai/foundry-sdk
 */

import { env } from "$env/dynamic/private";
import type { ClaudeResponse, Message, Tool } from "./types";

export interface FoundryConfig {
	apiKey: string;
	resource: string;
	model?: string;
}

export interface CreateMessageParams {
	model: string;
	max_tokens: number;
	system: string;
	tools: Tool[];
	messages: Message[];
}

/**
 * Mock Foundry client for development without Azure setup
 * In production, replace with actual @anthropic-ai/foundry-sdk
 */
export class MockFoundryClient {
	private config: FoundryConfig;

	constructor(config: FoundryConfig) {
		this.config = config;
	}

	/**
	 * Mock message creation - returns a simulated response
	 * In production, this calls the actual Foundry API
	 */
	async createMessage(params: CreateMessageParams): Promise<ClaudeResponse> {
		console.log("[MockFoundry] Creating message with:", {
			model: params.model,
			messageCount: params.messages.length,
			toolCount: params.tools.length,
		});

		// Simulate API call delay
		await new Promise((resolve) => setTimeout(resolve, 100));

		// In a real implementation, this would be:
		// const response = await this.client.messages.create({...});

		// Mock response - just ends the turn
		// In production, Claude would actually analyze and use tools
		return {
			id: `msg_${Date.now()}`,
			type: "message",
			role: "assistant",
			content: [
				{
					type: "text",
					text: "I am analyzing the market activity. [Mock response - replace with actual Foundry API in production]",
				},
			],
			model: params.model,
			stop_reason: "end_turn",
			usage: {
				input_tokens: 1000,
				output_tokens: 100,
			},
		};
	}
}

/**
 * Create a Foundry client
 * Uses mock client if no API key is provided
 */
export function createFoundryClient(config?: Partial<FoundryConfig>) {
	const apiKey = config?.apiKey || env.ANTHROPIC_FOUNDRY_API_KEY || "";
	const resource = config?.resource || env.ANTHROPIC_FOUNDRY_RESOURCE || "";

	// If we have real credentials, we'd use the actual SDK here
	// For now, always return mock client
	if (apiKey && resource) {
		console.log(
			"[Foundry] Using mock client - replace with actual SDK in production",
		);
	}

	return new MockFoundryClient({
		apiKey,
		resource,
		model: config?.model || "claude-sonnet-4-5",
	});
}

/**
 * Production Foundry client (uncomment when SDK is installed)
 *
 * import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
 *
 * export class FoundryClient {
 *   private client: AnthropicFoundry;
 *
 *   constructor(config: FoundryConfig) {
 *     this.client = new AnthropicFoundry({
 *       apiKey: config.apiKey,
 *       resource: config.resource,
 *     });
 *   }
 *
 *   async createMessage(params: CreateMessageParams): Promise<ClaudeResponse> {
 *     return await this.client.messages.create({
 *       model: params.model,
 *       max_tokens: params.max_tokens,
 *       system: params.system,
 *       tools: params.tools,
 *       messages: params.messages,
 *     });
 *   }
 * }
 */
