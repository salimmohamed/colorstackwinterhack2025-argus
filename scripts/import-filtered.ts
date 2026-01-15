/**
 * Import filtered suspects into Convex alerts
 * Run with: npx tsx scripts/import-filtered.ts
 */

import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import { api } from "../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface FilteredSuspect {
  _id: string;
  wallet: string;
  displayName: string;
  riskScore: number;
  totalProfit: number;
  winRate: number;
  totalTrades: number;
  accountAgeDays: number;
  totalVolume: number;
  flags: Array<{ type: string; description: string; severity: string; weight: number }>;
  evidence: Array<{ type: string; description: string; value: string }>;
  marketSlug: string;
  profileUrl: string;
}

function mapSignalType(flags: FilteredSuspect["flags"]): "new_account_large_bet" | "timing_correlation" | "statistical_improbability" | "account_obfuscation" | "disproportionate_bet" | "pattern_match" {
  const types = flags.map(f => f.type);
  if (types.includes("HIGH_WIN_RATE")) return "statistical_improbability";
  if (types.includes("FRESH_WALLET")) return "new_account_large_bet";
  if (types.includes("SUSPICIOUS_TIMING")) return "timing_correlation";
  if (types.includes("LARGE_PROFIT") || types.includes("RELATIVE_SIZE")) return "disproportionate_bet";
  return "pattern_match";
}

function determineSeverity(riskScore: number): "low" | "medium" | "high" | "critical" {
  if (riskScore >= 90) return "critical";
  if (riskScore >= 70) return "high";
  if (riskScore >= 50) return "medium";
  return "low";
}

// Apply trade count penalty - high trade counts suggest market makers, not insiders
function applyTradeCountPenalty(riskScore: number, totalTrades: number): number {
  let penalty = 0;

  if (totalTrades >= 200) {
    penalty = 45; // Heavy penalty for 200+ trades
  } else if (totalTrades >= 150) {
    penalty = 25; // Moderate penalty for 150+ trades
  } else if (totalTrades >= 100) {
    penalty = 10; // Light penalty for 100+ trades
  }

  return Math.max(0, riskScore - penalty);
}

function generateTitle(s: FilteredSuspect): string {
  const profit = `$${Math.round(s.totalProfit).toLocaleString()}`;
  const winRate = `${Math.round(s.winRate * 100)}%`;

  if (s.accountAgeDays < 30) {
    return `Fresh wallet (${s.accountAgeDays}d), ${profit} profit, ${winRate} win rate`;
  }
  if (s.winRate > 0.9) {
    return `${winRate} win rate on ${s.totalTrades} trades, ${profit} profit`;
  }
  return `${profit} profit with ${winRate} win rate across ${s.totalTrades} trades`;
}

function generateReasoning(s: FilteredSuspect): string {
  const parts: string[] = [];

  if (s.winRate > 0.9) {
    parts.push(`${Math.round(s.winRate * 100)}% win rate on ${s.totalTrades} trades is statistically improbable`);
  }
  if (s.totalProfit > 100000) {
    parts.push(`$${Math.round(s.totalProfit).toLocaleString()} total profit suggests information edge`);
  }
  if (s.accountAgeDays < 30) {
    parts.push(`account only ${s.accountAgeDays} days old`);
  }

  s.flags.slice(0, 2).forEach(f => {
    if (f.description && !parts.some(p => p.includes(f.type))) {
      parts.push(f.description.toLowerCase());
    }
  });

  return parts.join(". ") + ".";
}

async function main() {
  const data = JSON.parse(fs.readFileSync("/tmp/filtered-suspects.json", "utf-8")) as FilteredSuspect[];
  console.log(`Importing ${data.length} filtered suspects...\n`);

  // Dedupe by wallet address (keep highest risk score)
  const byWallet = new Map<string, FilteredSuspect>();
  for (const s of data) {
    const existing = byWallet.get(s.wallet);
    if (!existing || s.riskScore > existing.riskScore) {
      byWallet.set(s.wallet, s);
    }
  }
  const deduped = Array.from(byWallet.values());
  console.log(`After deduplication: ${deduped.length} unique wallets\n`);

  let created = 0;
  let failed = 0;

  for (const s of deduped) {
    try {
      // Apply trade count penalty to risk score
      const adjustedRiskScore = applyTradeCountPenalty(s.riskScore, s.totalTrades);

      // Upsert account
      const accountId = await convex.mutation(api.accounts.upsert, {
        address: s.wallet.toLowerCase(),
        displayName: s.displayName || undefined,
        totalTrades: s.totalTrades,
        totalVolume: s.totalVolume || 0,
        winRate: s.winRate,
        riskScore: adjustedRiskScore,
        flags: s.flags.map(f => f.type),
      });

      // Create alert
      await convex.mutation(api.alerts.create, {
        accountId,
        severity: determineSeverity(adjustedRiskScore),
        signalType: mapSignalType(s.flags),
        title: generateTitle(s),
        description: s.evidence?.map(e => e.description).join(". ") || generateReasoning(s),
        evidence: {
          metrics: {
            riskScore: adjustedRiskScore,
            originalRiskScore: s.riskScore,
            tradeCountPenalty: s.riskScore - adjustedRiskScore,
            totalProfit: s.totalProfit,
            totalVolume: s.totalVolume,
            winRate: s.winRate,
            accountAgeDays: s.accountAgeDays,
            totalTrades: s.totalTrades,
          },
          reasoning: generateReasoning(s),
        },
      });

      created++;
      console.log(`✓ ${s.displayName || s.wallet.slice(0, 10)} - $${Math.round(s.totalProfit).toLocaleString()}`);
    } catch (error) {
      failed++;
      console.error(`✗ ${s.wallet.slice(0, 10)}: ${error}`);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Created: ${created}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
