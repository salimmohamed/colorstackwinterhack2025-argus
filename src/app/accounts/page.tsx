"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";

type SortField = "riskScore" | "volume" | "winRate";

function getRiskColor(score: number) {
  if (score >= 70) return "#f44336";
  if (score >= 40) return "#ff9800";
  return "#4caf50";
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatVolume(vol: number) {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
  return `$${vol}`;
}

export default function AccountsPage() {
  const accounts = useQuery(api.accounts.listFlagged, {});
  const [sortField, setSortField] = useState<SortField>("riskScore");

  const sortedAccounts = useMemo(() => {
    if (!accounts) return undefined;
    return [...accounts].sort((a, b) => {
      switch (sortField) {
        case "riskScore":
          return b.riskScore - a.riskScore;
        case "volume":
          return (b.totalVolume ?? 0) - (a.totalVolume ?? 0);
        case "winRate":
          return (b.winRate ?? 0) - (a.winRate ?? 0);
        default:
          return 0;
      }
    });
  }, [accounts, sortField]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="text-[var(--text-dim)] text-xs tracking-[0.1em] uppercase hover:text-[var(--accent)] transition-colors mb-8 inline-block"
        >
          ← Back
        </Link>

        <header className="flex justify-between items-center pb-6 border-b border-[#1a1a1a] mb-8">
          <h1 className="text-2xl font-semibold text-[#fafafa]">
            Flagged Accounts
          </h1>
          <div>
            <label htmlFor="sort-accounts" className="sr-only">Sort accounts by</label>
            <select
              id="sort-accounts"
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              aria-label="Sort accounts by"
              className="px-4 py-2 bg-[#0a0a0a] border border-neutral-700 rounded text-neutral-400 text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-1 focus:ring-offset-[#030303]"
            >
              <option value="riskScore">Sort by Risk Score</option>
              <option value="volume">Sort by Volume</option>
              <option value="winRate">Sort by Win Rate</option>
            </select>
          </div>
        </header>

        {sortedAccounts === undefined ? (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-16 text-center">
            <span className="text-3xl text-[var(--accent)] animate-pulse">
              ◉
            </span>
            <p className="mt-4 text-sm text-neutral-400">Loading accounts...</p>
          </div>
        ) : sortedAccounts.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-16 text-center">
            <span className="text-4xl text-neutral-500 block mb-4">◎</span>
            <h3 className="text-base text-[#fafafa] mb-2">
              No flagged accounts
            </h3>
            <p className="text-sm text-neutral-400">
              Accounts will appear here when the agent flags suspicious
              activity.
            </p>
          </div>
        ) : (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_0.75fr_1fr_0.75fr_0.75fr] gap-4 px-6 py-4 bg-[#0f0f0f] text-xs font-bold text-neutral-400 uppercase tracking-wider">
              <span>Account</span>
              <span>Risk Score</span>
              <span>Trades</span>
              <span>Volume</span>
              <span>Win Rate</span>
              <span>Age</span>
            </div>

            {/* Table rows */}
            {sortedAccounts.map((account) => (
              <div
                key={account._id}
                className="grid grid-cols-[2fr_1fr_0.75fr_1fr_0.75fr_0.75fr] gap-4 px-6 py-4 items-center border-t border-[#1a1a1a] border-l-[3px] border-l-[#f44336] hover:bg-[#111] transition-colors cursor-pointer"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[#fafafa]">
                    {shortenAddress(account.address)}
                  </span>
                  {account.displayName && (
                    <span className="text-xs text-neutral-400">
                      {account.displayName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 rounded max-w-[60px]"
                    style={{
                      width: `${account.riskScore}%`,
                      backgroundColor: getRiskColor(account.riskScore),
                    }}
                  />
                  <span className="text-sm">{account.riskScore}</span>
                </div>
                <span className="text-sm">{account.totalTrades ?? 0}</span>
                <span className="text-sm">
                  {formatVolume(account.totalVolume ?? 0)}
                </span>
                <span className="text-sm">
                  {((account.winRate ?? 0) * 100).toFixed(0)}%
                </span>
                <span className="text-sm">
                  {account.accountAgeDays ?? "?"} days
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
