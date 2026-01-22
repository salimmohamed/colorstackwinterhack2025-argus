"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";

type Severity = "low" | "medium" | "high" | "critical";
type Status = "new" | "investigating" | "confirmed" | "dismissed";

function getSeverityColor(severity: Severity) {
  const colors = {
    low: "#22c55e",
    medium: "#f59e0b",
    high: "#ef4444",
    critical: "#a855f7",
  };
  return colors[severity];
}

function formatTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AlertsPage() {
  const alerts = useQuery(api.alerts.listRecent, { limit: 50 });
  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");

  const filteredAlerts = useMemo(() => {
    if (!alerts) return undefined;
    return alerts.filter((alert) => {
      if (severityFilter && alert.severity !== severityFilter) return false;
      if (statusFilter && alert.status !== statusFilter) return false;
      return true;
    });
  }, [alerts, severityFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="text-[var(--text-dim)] text-xs tracking-[0.1em] uppercase hover:text-[var(--accent)] transition-colors mb-8 inline-block"
        >
          ← Back
        </Link>

        <header className="flex justify-between items-start pb-6 border-b border-[#1a1a1a] mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[#fafafa]">
              ⚠ Detection Alerts
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Suspicious trading patterns flagged by Argus
            </p>
          </div>
          <div className="flex gap-2">
            <div>
              <label htmlFor="severity-filter" className="sr-only">Filter by severity</label>
              <select
                id="severity-filter"
                value={severityFilter}
                onChange={(e) =>
                  setSeverityFilter(e.target.value as Severity | "")
                }
                className="px-4 py-2 bg-[#0a0a0a] border border-neutral-700 rounded text-neutral-400 text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-1 focus:ring-offset-[#030303]"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label htmlFor="status-filter" className="sr-only">Filter by status</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Status | "")}
                className="px-4 py-2 bg-[#0a0a0a] border border-neutral-700 rounded text-neutral-400 text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-1 focus:ring-offset-[#030303]"
              >
                <option value="">All Statuses</option>
                <option value="new">New</option>
                <option value="investigating">Investigating</option>
                <option value="confirmed">Confirmed</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-3">
          {filteredAlerts === undefined ? (
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-16 text-center">
              <span className="text-3xl text-[var(--accent)] animate-pulse">
                ◉
              </span>
              <p className="mt-4 text-sm text-neutral-400">Loading alerts...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-16 text-center">
              <span className="text-4xl text-neutral-500 block mb-4">◎</span>
              <h3 className="text-base text-[#fafafa] mb-2">
                No alerts detected
              </h3>
              <p className="text-sm text-neutral-400">
                {severityFilter || statusFilter
                  ? "No alerts match the selected filters."
                  : "The agent will create alerts when it detects suspicious trading activity."}
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert._id}
                className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-5 hover:border-[#252525] hover:bg-[#0f0f0f] transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="px-2 py-1 rounded text-[0.65rem] font-bold uppercase tracking-wider text-white"
                    style={{
                      backgroundColor: getSeverityColor(alert.severity),
                    }}
                  >
                    {alert.severity}
                  </span>
                  <span className="text-xs text-neutral-400 capitalize">
                    {alert.signalType.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`ml-auto px-2 py-1 rounded text-[0.65rem] font-semibold uppercase tracking-wider ${
                      alert.status === "new"
                        ? "bg-[rgba(59,130,246,0.15)] text-[#3b82f6]"
                        : alert.status === "investigating"
                          ? "bg-[rgba(245,158,11,0.15)] text-[var(--accent)]"
                          : alert.status === "confirmed"
                            ? "bg-[rgba(239,68,68,0.15)] text-[#ef4444]"
                            : "bg-[rgba(34,197,94,0.15)] text-[#22c55e]"
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>
                <h3 className="text-base font-medium text-[#fafafa] mb-2">
                  {alert.title}
                </h3>
                <p className="text-sm text-neutral-400 leading-relaxed mb-3">
                  {alert.evidence.reasoning.slice(0, 150)}...
                </p>
                <div className="flex justify-between items-center pt-3 border-t border-[#1a1a1a] text-xs text-neutral-500">
                  <span className="font-mono">
                    <span className="text-neutral-500">Account: </span>
                    {alert.accountAddress.slice(0, 6)}...
                    {alert.accountAddress.slice(-4)}
                  </span>
                  <span>{formatTime(alert.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
