/**
 * Polymarket API clients - aggregated exports
 */

export * from "./gamma";
export * from "./data-api";
export * from "./subgraph";

// Re-export singleton instances
export { gammaClient } from "./gamma";
export { dataApiClient } from "./data-api";
export { subgraphClient } from "./subgraph";
