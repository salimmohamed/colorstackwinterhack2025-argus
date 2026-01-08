import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Run the insider trading detection agent every 15 minutes
 * This is the scheduled monitoring that runs autonomously
 */
crons.interval(
	"monitor-markets",
	{ minutes: 15 },
	internal.agentRuns.triggerScheduledRun,
);

/**
 * Sync market data from Polymarket API every 30 minutes
 */
crons.interval(
	"sync-markets",
	{ minutes: 30 },
	internal.markets.syncFromPolymarket,
);

/**
 * Clean up old activity feed entries daily
 */
crons.daily(
	"cleanup-activity-feed",
	{ hourUTC: 4, minuteUTC: 0 },
	internal.activityFeed.cleanup,
);

export default crons;
