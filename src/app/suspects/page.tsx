"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PixelBlastEye } from "@/components/ui/pixel-blast-eye";
import { api } from "../../../convex/_generated/api";

type Severity = "low" | "medium" | "high" | "critical";

interface Alert {
  _id: string;
  accountAddress: string;
  severity: Severity;
  signalType: string;
  title: string;
  description: string;
  evidence: {
    metrics: Record<string, unknown>;
    reasoning: string;
  };
  createdAt: number;
}

const SEVERITY_CONFIG = {
  critical: { label: "CRITICAL", color: "var(--accent)" },
  high: { label: "HIGH", color: "var(--accent)" },
  medium: { label: "MEDIUM", color: "var(--text-dim)" },
  low: { label: "LOW", color: "var(--text-muted)" },
};

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ============================================
   STAT CARD COMPONENT
   ============================================ */
function StatCard({
  count,
  label,
  isAccent,
  delay,
}: {
  count: number;
  label: string;
  isAccent?: boolean;
  delay: string;
}) {
  return (
    <div
      className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 hover:border-[#252525] transition-all animate-fadeSlideUp"
      style={{ animationDelay: delay }}
    >
      <div
        className={`text-2xl font-semibold ${isAccent && count > 0 ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}
      >
        {count}
      </div>
      <div className="text-[0.6rem] tracking-[0.12em] uppercase text-[var(--text-muted)] mt-1">
        {label}
      </div>
    </div>
  );
}

/* ============================================
   SUSPECT CARD COMPONENT
   ============================================ */
function SuspectCard({
  alert,
  isOpen,
  onToggle,
  delay,
}: {
  alert: Alert;
  isOpen: boolean;
  onToggle: () => void;
  delay: string;
}) {
  const config = SEVERITY_CONFIG[alert.severity];
  const metrics =
    (alert.evidence?.metrics as Record<string, number | string>) || {};
  const isHighPriority =
    alert.severity === "critical" || alert.severity === "high";

  return (
    <div className="animate-fadeSlideUp" style={{ animationDelay: delay }}>
      <div
        onClick={onToggle}
        className={`
          bg-[#0a0a0a] border cursor-pointer transition-all
          ${isHighPriority ? "border-[rgba(245,158,11,0.3)]" : "border-[#1a1a1a]"}
          ${isOpen ? "border-[#252525]" : ""}
          hover:border-[#252525]
        `}
      >
        {/* Header */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Address & Time */}
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm text-[var(--foreground)]">
                  {alert.accountAddress.slice(0, 6)}...
                  {alert.accountAddress.slice(-4)}
                </span>
                <span
                  className="text-[0.55rem] tracking-[0.15em] uppercase font-semibold px-2 py-0.5"
                  style={{
                    color: config.color,
                    backgroundColor: isHighPriority
                      ? "rgba(245,158,11,0.1)"
                      : "transparent",
                  }}
                >
                  {config.label}
                </span>
              </div>

              {/* Title */}
              <p className="text-sm text-[var(--text-dim)] leading-relaxed">
                {alert.title}
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4 text-right shrink-0">
              {metrics.totalProfit !== undefined && (
                <div>
                  <div className="text-[0.55rem] text-[var(--text-muted)] tracking-wider uppercase">
                    Profit
                  </div>
                  <div className="text-sm text-[var(--foreground)] font-mono">
                    ${Number(metrics.totalProfit).toLocaleString()}
                  </div>
                </div>
              )}
              {metrics.riskScore !== undefined && (
                <div>
                  <div className="text-[0.55rem] text-[var(--text-muted)] tracking-wider uppercase">
                    Risk
                  </div>
                  <div
                    className={`text-sm font-mono ${Number(metrics.riskScore) >= 80 ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}
                  >
                    {metrics.riskScore}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expand indicator */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#151515]">
            <span className="text-[0.55rem] text-[var(--text-muted)] tracking-[0.1em] uppercase">
              {alert.signalType.replace(/_/g, " ")}
            </span>
            <div className="flex-1 h-px bg-[#1a1a1a]" />
            <span className="text-[0.55rem] text-[var(--text-muted)]">
              {formatTimeAgo(alert.createdAt)}
            </span>
            <span
              className="text-[var(--text-muted)] text-[0.6rem] transition-transform duration-300"
              style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              ▼
            </span>
          </div>
        </div>

        {/* Expandable Section */}
        {isOpen && (
          <div className="px-5 pb-5 pt-0 animate-fadeIn">
            <div className="bg-[#080808] border border-[#151515] p-4">
              <div className="text-[0.6rem] tracking-[0.15em] uppercase text-[var(--accent)] mb-3">
                Why Flagged
              </div>
              <p className="text-sm text-[var(--text-dim)] leading-relaxed">
                {alert.evidence?.reasoning || "No detailed analysis available."}
              </p>

              {/* Metrics Grid */}
              {Object.keys(metrics).length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#1a1a1a]">
                  {Object.entries(metrics)
                    .filter(([key]) => !["displayName"].includes(key))
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <div key={key} className="bg-[#0a0a0a] px-3 py-2">
                        <div className="text-[0.5rem] text-[var(--text-muted)] tracking-wider uppercase truncate">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </div>
                        <div className="text-xs text-[var(--text-dim)] font-mono mt-0.5">
                          {typeof value === "number"
                            ? value >= 1000
                              ? `$${value.toLocaleString()}`
                              : value < 1 && value > 0
                                ? `${(value * 100).toFixed(1)}%`
                                : value
                            : String(value).slice(0, 15)}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Action Link */}
              <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
                <a
                  href={`https://polymarket.com/profile/${alert.accountAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 text-[0.65rem] tracking-wider uppercase text-[var(--accent)] hover:gap-3 transition-all"
                >
                  <span>View on Polymarket</span>
                  <span>→</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================
   MAIN PAGE COMPONENT
   ============================================ */
export default function SuspectsPage() {
  const alerts = useQuery(api.alerts.listRecent, { limit: 100 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const grouped = useMemo(() => {
    if (!alerts) return null;
    const g: Record<Severity, Alert[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    alerts.forEach((a) => {
      if (a.severity in g) g[a.severity as Severity].push(a as Alert);
    });
    // Sort each group by risk score (highest first)
    Object.keys(g).forEach((key) => {
      g[key as Severity].sort((a, b) => {
        const riskA =
          ((a.evidence?.metrics as Record<string, unknown>)
            ?.riskScore as number) || 0;
        const riskB =
          ((b.evidence?.metrics as Record<string, unknown>)
            ?.riskScore as number) || 0;
        return riskB - riskA;
      });
    });
    return g;
  }, [alerts]);

  const counts = grouped
    ? {
        critical: grouped.critical.length,
        high: grouped.high.length,
        medium: grouped.medium.length,
        low: grouped.low.length,
      }
    : { critical: 0, high: 0, medium: 0, low: 0 };

  const totalCount = counts.critical + counts.high + counts.medium + counts.low;

  return (
    <div className="min-h-screen relative" suppressHydrationWarning>
      {/* Full background - PixelBlast Eye */}
      <div className="fixed inset-0">
        <PixelBlastEye className="absolute inset-0" eyeOffsetX={0.2} />

        {/* Scanlines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.15) 2px, rgba(0, 0, 0, 0.15) 4px)",
          }}
        />

        {/* Grain overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 20%, var(--background) 80%)",
          }}
        />

        {/* Left fade for content readability */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, var(--background) 0%, var(--background) 30%, transparent 60%)",
          }}
        />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 min-h-screen">
        <div className="max-w-2xl min-h-screen p-8 flex flex-col">
          {/* Header */}
          <header className="mb-8">
            <nav
              className="mb-6 animate-fadeSlideUp"
              style={{ animationDelay: "0s" }}
            >
              <Link
                href="/"
                className="text-[var(--text-dim)] text-xs tracking-[0.15em] uppercase hover:text-[var(--accent)] transition-colors"
              >
                ← Back
              </Link>
            </nav>

            <div
              className="animate-fadeSlideUp"
              style={{ animationDelay: "0.1s" }}
            >
              <p className="text-[0.6rem] tracking-[0.35em] text-[var(--text-muted)] uppercase mb-2">
                Insider Detection
              </p>
              <h1 className="font-serif text-3xl text-[var(--foreground)]">
                Suspected Insiders
              </h1>
              {mounted && totalCount > 0 && (
                <p className="text-sm text-[var(--text-dim)] mt-2">
                  {totalCount} account{totalCount !== 1 ? "s" : ""} flagged for
                  review
                </p>
              )}
            </div>
          </header>

          {/* Stats Grid */}
          <section className="grid grid-cols-4 gap-3 mb-8">
            <StatCard
              count={counts.critical}
              label="Critical"
              isAccent
              delay="0.15s"
            />
            <StatCard count={counts.high} label="High" isAccent delay="0.2s" />
            <StatCard count={counts.medium} label="Medium" delay="0.25s" />
            <StatCard count={counts.low} label="Low" delay="0.3s" />
          </section>

          {/* Suspects List */}
          <section className="flex-1 overflow-auto">
            {!grouped ? (
              <div
                className="flex flex-col items-center py-16 animate-fadeSlideUp"
                style={{ animationDelay: "0.3s" }}
              >
                <span className="text-3xl text-[var(--accent)] animate-pulse">
                  ◉
                </span>
                <p className="mt-4 text-sm text-[var(--text-dim)]">
                  Loading suspects...
                </p>
              </div>
            ) : totalCount === 0 ? (
              <div
                className="flex flex-col items-center py-16 animate-fadeSlideUp"
                style={{ animationDelay: "0.3s" }}
              >
                <span className="text-4xl text-[var(--text-muted)] mb-4">
                  ◎
                </span>
                <h3 className="text-base text-[var(--foreground)] mb-2">
                  No Suspects Found
                </h3>
                <p className="text-sm text-[var(--text-dim)] text-center max-w-sm">
                  Suspects will appear here when suspicious trading patterns are
                  detected.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Critical & High Priority */}
                {[...grouped.critical, ...grouped.high].length > 0 && (
                  <div className="space-y-2">
                    {[...grouped.critical, ...grouped.high].map((alert, i) => (
                      <SuspectCard
                        key={alert._id}
                        alert={alert}
                        isOpen={openId === alert._id}
                        onToggle={() =>
                          setOpenId(openId === alert._id ? null : alert._id)
                        }
                        delay={`${0.35 + i * 0.05}s`}
                      />
                    ))}
                  </div>
                )}

                {/* Medium & Low */}
                {[...grouped.medium, ...grouped.low].length > 0 && (
                  <>
                    {[...grouped.critical, ...grouped.high].length > 0 && (
                      <div
                        className="flex items-center gap-3 py-4 animate-fadeSlideUp"
                        style={{ animationDelay: "0.5s" }}
                      >
                        <div className="h-px flex-1 bg-[#1a1a1a]" />
                        <span className="text-[0.55rem] tracking-[0.2em] text-[var(--text-muted)] uppercase">
                          Lower Priority
                        </span>
                        <div className="h-px flex-1 bg-[#1a1a1a]" />
                      </div>
                    )}
                    <div className="space-y-2">
                      {[...grouped.medium, ...grouped.low].map((alert, i) => (
                        <SuspectCard
                          key={alert._id}
                          alert={alert}
                          isOpen={openId === alert._id}
                          onToggle={() =>
                            setOpenId(openId === alert._id ? null : alert._id)
                          }
                          delay={`${0.55 + i * 0.05}s`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Footer */}
          <footer
            className="pt-8 mt-auto animate-fadeSlideUp"
            style={{ animationDelay: "0.8s" }}
          >
            <p className="font-serif italic text-sm text-[var(--text-dim)] leading-6">
              &ldquo;In the kingdom of the blind, the one-eyed man is
              king.&rdquo;
            </p>
            <p className="text-[0.65rem] text-[var(--text-muted)] mt-1 tracking-[0.08em]">
              — Erasmus
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
