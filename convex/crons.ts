import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Sync market data from Polymarket API every 30 minutes
 * Cost: FREE (just API calls to Polymarket)
 */
crons.interval(
  "sync-markets",
  { minutes: 30 },
  internal.autonomousActions.syncMarketsFromPolymarket,
);

/**
 * Run rules-based insider detection every 2 hours
 * Cost: FREE (just code logic, no AI)
 */
crons.interval(
  "rules-detection",
  { hours: 2 },
  internal.autonomousActions.runRulesDetection,
);

/**
 * Run AI-powered deep analysis every 12 hours
 * Cost: ~$0.05-0.20 per run (uses Claude via AWS Bedrock)
 * Requires APP_URL environment variable in Convex
 */
crons.interval(
  "ai-agent-analysis",
  { hours: 12 },
  internal.autonomousActions.triggerAIAgent,
);

/**
 * Clean up old activity feed entries daily
 * Cost: FREE
 */
crons.daily(
  "cleanup-activity-feed",
  { hourUTC: 4, minuteUTC: 0 },
  internal.activityFeed.cleanup,
);

export default crons;
