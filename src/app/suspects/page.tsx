"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";

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
  critical: {
    label: "CRITICAL",
    color: "#ff3b30",
    glow: "0 0 20px rgba(255, 59, 48, 0.5), 0 0 40px rgba(255, 59, 48, 0.2)",
    pulse: true,
  },
  high: {
    label: "HIGH",
    color: "#ff9500",
    glow: "0 0 15px rgba(255, 149, 0, 0.4)",
    pulse: false,
  },
  medium: {
    label: "MEDIUM",
    color: "#f59e0b",
    glow: "0 0 10px rgba(245, 158, 11, 0.3)",
    pulse: false,
  },
  low: {
    label: "LOW",
    color: "#30d158",
    glow: "none",
    pulse: false,
  },
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
   THREAT GAUGE COMPONENT
   ============================================ */
function ThreatGauge({ level, total }: { level: number; total: number }) {
  const percentage = total > 0 ? Math.min((level / total) * 100, 100) : 0;
  const threatLabel = percentage > 66 ? "ELEVATED" : percentage > 33 ? "MODERATE" : "LOW";
  const threatColor = percentage > 66 ? "#ff3b30" : percentage > 33 ? "#ff9500" : "#30d158";

  return (
    <div className="relative">
      <div className="flex items-center gap-4">
        <div className="text-[0.6rem] tracking-[0.3em] text-[#444]">THREAT LEVEL</div>
        <div className="flex-1 h-[2px] bg-[#1a1a1a] relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full transition-all duration-1000 ease-out"
            style={{
              width: `${percentage}%`,
              background: `linear-gradient(90deg, ${threatColor}44, ${threatColor})`,
              boxShadow: `0 0 10px ${threatColor}`,
            }}
          />
          {/* Scanning line */}
          <div
            className="absolute top-0 h-full w-8 animate-scan"
            style={{
              background: `linear-gradient(90deg, transparent, ${threatColor}66, transparent)`,
            }}
          />
        </div>
        <div
          className="text-[0.65rem] tracking-[0.2em] font-semibold"
          style={{ color: threatColor }}
        >
          {threatLabel}
        </div>
      </div>
    </div>
  );
}

/* ============================================
   STAT CARD COMPONENT
   ============================================ */
function StatCard({
  count,
  label,
  severity,
  index,
}: {
  count: number;
  label: string;
  severity: keyof typeof SEVERITY_CONFIG;
  index: number;
}) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <div
      className="relative group animate-slideUp"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Card */}
      <div
        className="relative overflow-hidden bg-[#0a0a0a] border border-[#1a1a1a] p-4 transition-all duration-300 hover:border-[#252525]"
        style={{
          boxShadow: count > 0 ? config.glow : "none",
        }}
      >
        {/* CRT scan line effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]" />
        </div>

        {/* Pulsing indicator for critical */}
        {config.pulse && count > 0 && (
          <div
            className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.color}` }}
          />
        )}

        {/* Content */}
        <div className="relative z-10">
          <div
            className="text-3xl font-light tracking-tight transition-transform duration-300 group-hover:scale-110"
            style={{ color: count > 0 ? config.color : "#333" }}
          >
            {count}
          </div>
          <div
            className="text-[0.6rem] tracking-[0.2em] mt-1 uppercase"
            style={{ color: count > 0 ? config.color : "#444" }}
          >
            {label}
          </div>
        </div>

        {/* Corner accent */}
        <div
          className="absolute bottom-0 right-0 w-8 h-8 opacity-20"
          style={{
            background: `linear-gradient(135deg, transparent 50%, ${config.color} 50%)`,
          }}
        />
      </div>
    </div>
  );
}

/* ============================================
   DOSSIER CARD (SUSPECT) COMPONENT
   ============================================ */
function DossierCard({
  alert,
  isOpen,
  onToggle,
  index,
}: {
  alert: Alert;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  const config = SEVERITY_CONFIG[alert.severity];
  const metrics = alert.evidence?.metrics as Record<string, number | string> || {};

  return (
    <div
      className="animate-slideUp"
      style={{ animationDelay: `${0.2 + index * 0.08}s` }}
    >
      <div
        onClick={onToggle}
        className={`
          relative overflow-hidden cursor-pointer transition-all duration-500
          bg-[#080808] border-l-2 hover:bg-[#0c0c0c]
          ${isOpen ? "border-[#252525]" : "border-[#151515]"}
        `}
        style={{
          borderLeftColor: config.color,
          boxShadow: isOpen ? config.glow : "none",
        }}
      >
        {/* Classification stamp */}
        <div
          className="absolute top-0 right-0 px-3 py-1 text-[0.55rem] tracking-[0.25em] font-bold uppercase"
          style={{
            backgroundColor: `${config.color}15`,
            color: config.color,
            borderBottom: `1px solid ${config.color}33`,
            borderLeft: `1px solid ${config.color}33`,
          }}
        >
          {config.label}
        </div>

        {/* Main content area */}
        <div className="p-5 pr-24">
          {/* Header row */}
          <div className="flex items-start gap-4">
            {/* Subject identifier */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-[#e8e8e8] tracking-wide">
                  {alert.accountAddress.slice(0, 6)}····{alert.accountAddress.slice(-4)}
                </span>
                <span className="text-[0.55rem] text-[#333] tracking-wider">
                  │ {formatTimeAgo(alert.createdAt)}
                </span>
              </div>

              {metrics.displayName && (
                <div className="text-xs text-[#555] font-serif italic mb-2">
                  aka &ldquo;{String(metrics.displayName)}&rdquo;
                </div>
              )}

              <h3 className="text-sm text-[#999] leading-relaxed pr-4">
                {alert.title}
              </h3>
            </div>

            {/* Quick stats */}
            <div className="flex gap-4 text-right">
              {metrics.tradeAmount && (
                <div>
                  <div className="text-[0.55rem] text-[#444] tracking-wider uppercase">Bet</div>
                  <div className="text-sm text-[#888] font-mono">
                    ${Number(metrics.tradeAmount).toLocaleString()}
                  </div>
                </div>
              )}
              {metrics.accountAgeDays !== undefined && (
                <div>
                  <div className="text-[0.55rem] text-[#444] tracking-wider uppercase">Age</div>
                  <div className="text-sm text-[#888] font-mono">
                    {metrics.accountAgeDays}d
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signal type tag */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[0.55rem] text-[#333] tracking-[0.15em] uppercase">
              Signal: {alert.signalType.replace(/_/g, " ")}
            </span>
            <div className="flex-1 h-px bg-[#1a1a1a]" />
            <span
              className="text-[0.55rem] tracking-wider transition-transform duration-300"
              style={{
                color: "#444",
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▼
            </span>
          </div>
        </div>

        {/* Expandable AI Analysis Section */}
        <div
          className="overflow-hidden transition-all duration-500 ease-out"
          style={{
            maxHeight: isOpen ? "600px" : "0px",
            opacity: isOpen ? 1 : 0,
          }}
        >
          <div className="border-t border-[#1a1a1a]">
            {/* Classification header */}
            <div
              className="px-5 py-2 flex items-center gap-3"
              style={{ backgroundColor: `${config.color}08` }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: config.color }}
              />
              <span
                className="text-[0.6rem] tracking-[0.25em] uppercase font-semibold"
                style={{ color: config.color }}
              >
                AI Analysis — Declassified
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: `linear-gradient(90deg, ${config.color}33, transparent)` }}
              />
            </div>

            {/* Reasoning content */}
            <div className="px-5 py-4 bg-[#050505]">
              <p className="text-sm text-[#777] leading-[1.8] font-light">
                {alert.evidence?.reasoning || "No detailed analysis available."}
              </p>

              {/* Evidence grid */}
              {Object.keys(metrics).length > 0 && (
                <div className="mt-5 pt-4 border-t border-[#151515]">
                  <div className="text-[0.55rem] text-[#333] tracking-[0.2em] uppercase mb-3">
                    Evidence Metrics
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(metrics).slice(0, 6).map(([key, value]) => (
                      <div
                        key={key}
                        className="bg-[#0a0a0a] border border-[#151515] px-3 py-2"
                      >
                        <div className="text-[0.5rem] text-[#444] tracking-wider uppercase truncate">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </div>
                        <div className="text-xs text-[#666] font-mono mt-0.5">
                          {typeof value === "number"
                            ? value >= 1000
                              ? `$${value.toLocaleString()}`
                              : value < 1 && value > 0
                                ? `${(value * 100).toFixed(1)}%`
                                : value
                            : String(value).slice(0, 20)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action link */}
              <div className="mt-4 pt-4 border-t border-[#151515]">
                <a
                  href={`https://polymarket.com/profile/${alert.accountAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 text-[0.65rem] tracking-wider uppercase transition-all hover:gap-3"
                  style={{ color: config.color }}
                >
                  <span>View Subject Profile</span>
                  <span>→</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Scan line overlay on hover */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(180deg, transparent, ${config.color}05, transparent)`,
            backgroundSize: "100% 300%",
            animation: "scanDown 2s linear infinite",
          }}
        />
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
    const g: Record<Severity, Alert[]> = { critical: [], high: [], medium: [], low: [] };
    alerts.forEach((a) => {
      if (a.severity in g) g[a.severity as Severity].push(a as Alert);
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

  const totalThreats = counts.critical * 3 + counts.high * 2 + counts.medium;
  const maxThreat = (counts.critical + counts.high + counts.medium + counts.low) * 3 || 1;

  return (
    <div className="min-h-screen bg-[#030303] text-[#e8e8e8] overflow-x-hidden">
      {/* Ambient effects */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#030303_70%)]" />

        {/* Top glow based on threat level */}
        {mounted && counts.critical > 0 && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse_at_top,rgba(255,59,48,0.1)_0%,transparent_70%)] animate-pulse" />
        )}

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(#fff 1px, transparent 1px),
              linear-gradient(90deg, #fff 1px, transparent 1px)
            `,
            backgroundSize: "100px 100px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-10">
          <nav className="mb-8 animate-slideUp">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[#444] text-[0.65rem] tracking-[0.2em] uppercase hover:text-[var(--accent)] transition-colors"
            >
              <span>←</span>
              <span>Command Center</span>
            </Link>
          </nav>

          <div className="flex items-end justify-between gap-8 pb-6 border-b border-[#151515]">
            <div className="animate-slideUp" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-[0.55rem] tracking-[0.4em] text-[#333] uppercase">
                  Argus Intelligence
                </div>
                <div className="px-2 py-0.5 bg-[#ff3b3015] border border-[#ff3b3033] text-[#ff3b30] text-[0.5rem] tracking-[0.2em] uppercase">
                  Live
                </div>
              </div>
              <h1 className="font-serif text-3xl tracking-wide text-[#fafafa]">
                Suspect Dossiers
              </h1>
            </div>

            <div className="w-64 animate-slideUp" style={{ animationDelay: "0.1s" }}>
              <ThreatGauge level={totalThreats} total={maxThreat} />
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-4 gap-3 mb-10">
          <StatCard count={counts.critical} label="Critical" severity="critical" index={0} />
          <StatCard count={counts.high} label="High" severity="high" index={1} />
          <StatCard count={counts.medium} label="Medium" severity="medium" index={2} />
          <StatCard count={counts.low} label="Low Risk" severity="low" index={3} />
        </section>

        {/* Dossier List */}
        <section>
          {!grouped ? (
            <div className="flex flex-col items-center py-20 animate-slideUp">
              <div className="relative">
                <div
                  className="w-12 h-12 rounded-full border-2 border-[var(--accent)] animate-spin"
                  style={{ borderTopColor: "transparent" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                </div>
              </div>
              <p className="mt-6 text-xs text-[#444] tracking-wider uppercase">
                Scanning intelligence feeds...
              </p>
            </div>
          ) : counts.critical + counts.high + counts.medium + counts.low === 0 ? (
            <div className="flex flex-col items-center py-20 animate-slideUp">
              <div className="text-5xl text-[#1a1a1a] mb-4">◎</div>
              <h3 className="text-base text-[#666] mb-2">No Active Subjects</h3>
              <p className="text-xs text-[#444] text-center max-w-sm">
                Intelligence gathering in progress. Subjects will appear here
                when suspicious trading patterns are detected.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Critical */}
              {grouped.critical.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-[0.6rem] tracking-[0.3em] uppercase text-[#ff3b30]">
                      Immediate Threats
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#ff3b3033] to-transparent" />
                    <span className="text-[0.55rem] text-[#333] tracking-wider">
                      {grouped.critical.length} SUBJECT{grouped.critical.length !== 1 ? "S" : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grouped.critical.map((alert, i) => (
                      <DossierCard
                        key={alert._id}
                        alert={alert}
                        isOpen={openId === alert._id}
                        onToggle={() => setOpenId(openId === alert._id ? null : alert._id)}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* High */}
              {grouped.high.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-[0.6rem] tracking-[0.3em] uppercase text-[#ff9500]">
                      High Priority
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#ff950033] to-transparent" />
                    <span className="text-[0.55rem] text-[#333] tracking-wider">
                      {grouped.high.length} SUBJECT{grouped.high.length !== 1 ? "S" : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grouped.high.map((alert, i) => (
                      <DossierCard
                        key={alert._id}
                        alert={alert}
                        isOpen={openId === alert._id}
                        onToggle={() => setOpenId(openId === alert._id ? null : alert._id)}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Medium */}
              {grouped.medium.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-[0.6rem] tracking-[0.3em] uppercase text-[var(--accent)]">
                      Under Review
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-[rgba(245,158,11,0.2)] to-transparent" />
                    <span className="text-[0.55rem] text-[#333] tracking-wider">
                      {grouped.medium.length} SUBJECT{grouped.medium.length !== 1 ? "S" : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grouped.medium.map((alert, i) => (
                      <DossierCard
                        key={alert._id}
                        alert={alert}
                        isOpen={openId === alert._id}
                        onToggle={() => setOpenId(openId === alert._id ? null : alert._id)}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Low */}
              {grouped.low.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-[0.6rem] tracking-[0.3em] uppercase text-[#30d158]">
                      Low Confidence
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#30d15833] to-transparent" />
                    <span className="text-[0.55rem] text-[#333] tracking-wider">
                      {grouped.low.length} SUBJECT{grouped.low.length !== 1 ? "S" : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grouped.low.map((alert, i) => (
                      <DossierCard
                        key={alert._id}
                        alert={alert}
                        isOpen={openId === alert._id}
                        onToggle={() => setOpenId(openId === alert._id ? null : alert._id)}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-[#151515] animate-slideUp" style={{ animationDelay: "0.4s" }}>
          <p className="font-serif italic text-sm text-[#333]">
            &ldquo;In the kingdom of the blind, the one-eyed man is king.&rdquo;
          </p>
          <p className="text-[0.55rem] text-[#222] mt-1 tracking-wider">
            — Erasmus
          </p>
        </footer>
      </div>

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scan {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(400%);
          }
        }

        @keyframes scanDown {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 0 100%;
          }
        }

        .animate-slideUp {
          opacity: 0;
          animation: slideUp 0.6s ease-out forwards;
        }

        .animate-scan {
          animation: scan 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
