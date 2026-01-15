/**
 * Filter suspects through Claude on Bedrock
 * Run with: npx tsx scripts/filter-suspects.ts
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import * as fs from "fs";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

interface Suspect {
  _id: string;
  wallet: string;
  displayName: string;
  riskScore: number;
  totalProfit: number;
  winRate: number;
  totalTrades: number;
  accountAgeDays: number;
  flags: Array<{ type: string; description: string; severity: string }>;
  evidence: Array<{ type: string; description: string; value: string }>;
  marketSlug: string;
}

async function filterBatch(suspects: Suspect[]): Promise<string[]> {
  const summaries = suspects.map((s, i) =>
    `${i + 1}. ${s.displayName || s.wallet.slice(0, 10)} | Risk: ${s.riskScore} | Profit: $${s.totalProfit?.toLocaleString()} | Win: ${(s.winRate * 100).toFixed(0)}% | Trades: ${s.totalTrades} | Age: ${s.accountAgeDays}d | Flags: ${s.flags?.map(f => f.type).join(", ")}`
  ).join("\n");

  const prompt = `You are filtering Polymarket insider trading suspects. Review these ${suspects.length} accounts and return ONLY the IDs of accounts that show GENUINE insider trading signals.

KEEP accounts with:
- High profit ($10K+) AND high win rate (80%+) AND suspicious timing/patterns
- New accounts (< 30 days) with large concentrated bets
- Statistical improbabilities (95%+ win rate on 10-50 trades)
- Timing correlations with news events

REJECT accounts that are likely just:
- Skilled traders with diversified portfolios
- Market makers or liquidity providers (100+ trades is a red flag)
- Lucky retail traders with small profits
- High volume traders with normal win rates (50-70%)
- IMPORTANT: Accounts with 150+ trades are almost certainly market makers, NOT insiders
- Accounts with 200+ trades should almost never be kept

SUSPECTS TO REVIEW:
${summaries}

Return a JSON array of numbers (1-indexed) for accounts to KEEP. Example: [1, 5, 12]
Only return the JSON array, nothing else.`;

  const response = await client.send(
    new ConverseCommand({
      modelId: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0 },
    })
  );

  const text = (response.output?.message?.content?.[0] as any)?.text || "[]";

  try {
    const indices: number[] = JSON.parse(text.trim());
    return indices.map(i => suspects[i - 1]?._id).filter(Boolean);
  } catch {
    console.error("Failed to parse response:", text);
    return [];
  }
}

async function main() {
  const data = JSON.parse(fs.readFileSync("/tmp/suspects.json", "utf-8")) as Suspect[];
  console.log(`Loaded ${data.length} suspects`);

  // Sort by risk score to prioritize high-risk
  data.sort((a, b) => b.riskScore - a.riskScore);

  const BATCH_SIZE = 30;
  const keepIds: string[] = [];

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(data.length / BATCH_SIZE)}...`);

    const kept = await filterBatch(batch);
    keepIds.push(...kept);
    console.log(`  Kept ${kept.length}/${batch.length} from this batch`);

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Total suspects: ${data.length}`);
  console.log(`Kept after filtering: ${keepIds.length}`);

  // Get the full suspect data for kept IDs
  const keptSuspects = data.filter(s => keepIds.includes(s._id));

  // Save filtered results
  fs.writeFileSync("/tmp/filtered-suspects.json", JSON.stringify(keptSuspects, null, 2));
  console.log(`\nSaved ${keptSuspects.length} filtered suspects to /tmp/filtered-suspects.json`);

  // Print top 10
  console.log(`\n=== TOP 10 FILTERED SUSPECTS ===`);
  keptSuspects.slice(0, 10).forEach((s, i) => {
    console.log(`${i + 1}. ${s.displayName || s.wallet.slice(0, 10)} - $${s.totalProfit?.toLocaleString()} profit, ${(s.winRate * 100).toFixed(0)}% win rate`);
  });
}

main().catch(console.error);
