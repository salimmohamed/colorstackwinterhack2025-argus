/**
 * Seed Demo Data for Hackathon
 * Run with: npx tsx scripts/seed-demo.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Realistic-looking demo suspects
const demoSuspects = [
  {
    address: "0x7a3d2b9c4e1f8a6b3c5d7e9f0a2b4c6d8e0f1a3b",
    displayName: "whale_trader_99",
    totalTrades: 12,
    totalVolume: 287000,
    winRate: 0.92,
    riskScore: 89,
    flags: ["HIGH_WIN_RATE", "FRESH_WALLET", "CONCENTRATED_BETS"],
    alert: {
      severity: "critical" as const,
      signalType: "statistical_improbability" as const,
      title: "92% win rate on new account with 12 trades",
      description: "Account created 3 days ago with near-perfect prediction accuracy. $287K volume concentrated in 2028 Democratic nominee market. Statistical probability: 0.003%",
    },
  },
  {
    address: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c",
    displayName: "anon_predictions",
    totalTrades: 47,
    totalVolume: 156000,
    winRate: 0.78,
    riskScore: 76,
    flags: ["SUSPICIOUS_TIMING", "LARGE_PROFIT"],
    alert: {
      severity: "high" as const,
      signalType: "timing_correlation" as const,
      title: "Trades placed 2-4 hours before major news events",
      description: "Pattern analysis shows 8 of 12 large positions opened within hours of significant market-moving announcements. Correlation coefficient: 0.84",
    },
  },
  {
    address: "0x9f8e7d6c5b4a3928170f6e5d4c3b2a19087f6e5d",
    displayName: null,
    totalTrades: 3,
    totalVolume: 89000,
    winRate: 1.0,
    riskScore: 94,
    flags: ["FRESH_WALLET", "OVERSIZED_POSITION", "HIGH_WIN_RATE"],
    alert: {
      severity: "critical" as const,
      signalType: "new_account_large_bet" as const,
      title: "New wallet with $89K single position, 100% win rate",
      description: "Wallet created 18 hours before placing $89K bet on Newsom nomination. No prior trading history. 3 trades, all profitable.",
    },
  },
  {
    address: "0x4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
    displayName: "smart_money_alpha",
    totalTrades: 156,
    totalVolume: 2340000,
    winRate: 0.67,
    riskScore: 62,
    flags: ["MARKET_DOMINANCE", "RELATIVE_SIZE"],
    alert: {
      severity: "high" as const,
      signalType: "disproportionate_bet" as const,
      title: "Controls 34% of YES positions in target market",
      description: "Single account holds disproportionate market share. Average position size 8.4x market average. Whale activity patterns detected.",
    },
  },
  {
    address: "0x2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    displayName: "prediction_master_x",
    totalTrades: 28,
    totalVolume: 445000,
    winRate: 0.85,
    riskScore: 71,
    flags: ["HIGH_WIN_RATE", "CONCENTRATED_BETS"],
    alert: {
      severity: "high" as const,
      signalType: "pattern_match" as const,
      title: "85% win rate with concentrated political bets",
      description: "Account shows unusual accuracy specifically in political markets. 24 of 28 trades in 2028 election category. Cross-referenced with similar account patterns.",
    },
  },
  {
    address: "0x8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f",
    displayName: "insider_alpha",
    totalTrades: 8,
    totalVolume: 178000,
    winRate: 0.88,
    riskScore: 83,
    flags: ["SUSPICIOUS_TIMING", "FRESH_WALLET", "HIGH_WIN_RATE"],
    alert: {
      severity: "critical" as const,
      signalType: "timing_correlation" as const,
      title: "Consistent pre-announcement positioning",
      description: "7 of 8 trades placed 1-6 hours before candidate announcements. Account age: 12 days. Profit: $67K. Timing correlation: 0.91",
    },
  },
  {
    address: "0x6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
    displayName: null,
    totalTrades: 5,
    totalVolume: 312000,
    winRate: 0.8,
    riskScore: 68,
    flags: ["OVERSIZED_POSITION", "CONCENTRATED_BETS"],
    alert: {
      severity: "medium" as const,
      signalType: "disproportionate_bet" as const,
      title: "Anonymous wallet with outsized positions",
      description: "No display name set. 5 trades averaging $62K each. All positions in Democratic primary markets. Position sizes 12x market median.",
    },
  },
];

async function seedDemoData() {
  console.log("Seeding demo data...\n");

  for (const suspect of demoSuspects) {
    try {
      // Create account
      const accountId = await convex.mutation(api.accounts.upsert, {
        address: suspect.address,
        displayName: suspect.displayName || undefined,
        totalTrades: suspect.totalTrades,
        totalVolume: suspect.totalVolume,
        winRate: suspect.winRate,
        riskScore: suspect.riskScore,
        flags: suspect.flags,
      });

      console.log(`Created account: ${suspect.displayName || suspect.address.slice(0, 10)}...`);

      // Create alert
      await convex.mutation(api.alerts.create, {
        accountId,
        severity: suspect.alert.severity,
        signalType: suspect.alert.signalType,
        title: suspect.alert.title,
        description: suspect.alert.description,
        evidence: {
          metrics: {
            riskScore: suspect.riskScore,
            totalVolume: suspect.totalVolume,
            winRate: suspect.winRate,
            totalTrades: suspect.totalTrades,
          },
          reasoning: suspect.alert.description,
        },
      });

      console.log(`  + Alert: ${suspect.alert.severity.toUpperCase()} - ${suspect.alert.title.slice(0, 50)}...`);
    } catch (error) {
      console.error(`Error seeding ${suspect.address}:`, error);
    }
  }

  console.log("\nDone! Created", demoSuspects.length, "suspects with alerts.");
}

seedDemoData().catch(console.error);
