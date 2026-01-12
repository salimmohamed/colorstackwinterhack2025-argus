/**
 * Polymarket API clients - aggregated exports
 */

export * from "./data-api";
export { dataApiClient } from "./data-api";
export * from "./gamma";

// Re-export singleton instances
export { gammaClient } from "./gamma";
export * from "./subgraph";
export { subgraphClient } from "./subgraph";
