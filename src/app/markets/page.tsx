"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";

function formatVolume(vol: number) {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
  return `$${vol}`;
}

function formatTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatPrice(price: number): string {
  if (price === undefined || price === null || isNaN(price) || !isFinite(price)) {
    return "0%";
  }
  return `${(price * 100).toFixed(0)}%`;
}

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export default function MarketsPage() {
  const markets = useQuery(api.markets.listActive, {});
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const syncMarkets = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const res = await fetch("/api/markets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json();
      console.log("Sync result:", data);
      setLastSyncTime(Date.now());
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Auto-sync every 30 minutes
  useEffect(() => {
    // Start the interval
    syncIntervalRef.current = setInterval(() => {
      console.log("[Auto-sync] Triggering market sync...");
      syncMarkets();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [syncMarkets]);

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

        <header className="flex justify-between items-start pb-6 border-b border-[#1a1a1a] mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[#fafafa]">◎ Monitored Markets</h1>
            <p className="mt-2 text-sm text-[#666]">Political prediction markets under surveillance</p>
          </div>
          <button
            onClick={syncMarkets}
            disabled={isSyncing}
            className={`flex items-center gap-2 px-4 py-2 bg-transparent border border-[#252525] rounded text-[#888] text-xs transition-all ${
              isSyncing
                ? "opacity-50 cursor-not-allowed"
                : "hover:border-[var(--accent)] hover:text-[var(--accent)] hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]"
            }`}
          >
            <span className={isSyncing ? "animate-spin" : ""}>↻</span>
            {isSyncing ? "Syncing..." : "Sync Markets"}
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets === undefined ? (
            <div className="col-span-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-16 text-center">
              <span className="text-3xl text-[var(--accent)] animate-pulse">◉</span>
              <p className="mt-4 text-sm text-[#666]">Loading markets...</p>
            </div>
          ) : markets.length === 0 ? (
            <div className="col-span-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-16 text-center">
              <span className="text-4xl text-[#333] block mb-4">◎</span>
              <h3 className="text-base text-[#fafafa] mb-2">No markets being monitored</h3>
              <p className="text-sm text-[#666] mb-6">Add a Polymarket market to start monitoring for insider trading.</p>
              <button
                onClick={syncMarkets}
                className="px-4 py-2 bg-transparent border border-[#252525] rounded text-[#888] text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
              >
                Sync from Polymarket
              </button>
            </div>
          ) : (
            markets.map((market) => (
              <div
                key={market._id}
                className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-5 hover:border-[#252525] hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] transition-all"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="px-2 py-1 bg-[rgba(245,158,11,0.1)] text-[var(--accent)] rounded text-[0.65rem] font-semibold uppercase tracking-wider">
                    {market.category}
                  </span>
                  <span className="text-xs text-[#22c55e] font-semibold">
                    {formatVolume(market.totalVolume)}
                  </span>
                </div>
                <h3 className="text-[0.95rem] font-medium text-[#fafafa] mb-4 leading-snug">
                  {market.question}
                </h3>
                <div className="flex flex-col gap-2 mb-4">
                  {market.outcomes.map((outcome, i) => (
                    <div
                      key={i}
                      className={`flex justify-between items-center px-3 py-2 bg-[#111] border rounded relative overflow-hidden ${
                        i === 0
                          ? "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.05)]"
                          : "border-[#1a1a1a]"
                      }`}
                    >
                      <div className="flex items-center gap-2 z-10">
                        <span className={`text-[0.65rem] font-semibold ${i === 0 ? "text-[var(--accent)]" : "text-[#444]"}`}>
                          #{i + 1}
                        </span>
                        <span className={`text-sm font-medium ${i === 0 ? "text-[#fafafa]" : "text-[#ccc]"}`}>
                          {outcome.name}
                        </span>
                      </div>
                      <span className={`text-sm font-bold z-10 ${i === 0 ? "text-[var(--accent)]" : "text-[#888]"}`}>
                        {formatPrice(outcome.price)}
                      </span>
                      <div
                        className={`absolute left-0 top-0 bottom-0 ${
                          i === 0 ? "bg-[rgba(245,158,11,0.05)]" : "bg-[rgba(255,255,255,0.02)]"
                        }`}
                        style={{ width: `${isNaN(outcome.price) ? 0 : outcome.price * 100}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-[#1a1a1a] text-[0.7rem] text-[#444]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                    Active
                  </span>
                  <span>Synced {formatTime(market.lastSyncedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
