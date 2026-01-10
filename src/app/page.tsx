"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Link from "next/link";
import { PixelBlastEye } from "@/components/ui/pixel-blast-eye";

export default function Home() {
  const markets = useQuery(api.markets.listActive, {});

  return (
    <div className="min-h-screen relative flex" suppressHydrationWarning>
      {/* Left side - Text content (40%) */}
      <div className="w-[40%] min-h-screen relative z-10 bg-[var(--background)]">
        <div className="flex flex-col min-h-screen p-12 pr-16">
          <header className="mb-8 animate-fadeSlideUp" style={{ animationDelay: "0s" }}>
            <nav className="flex gap-6">
              <Link
                href="/markets"
                className="text-[var(--text-dim)] text-xs tracking-[0.15em] uppercase py-2 border-b border-transparent hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
              >
                Markets
              </Link>
              <Link
                href="/suspects"
                className="text-[var(--text-dim)] text-xs tracking-[0.15em] uppercase py-2 border-b border-transparent hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
              >
                Suspects
              </Link>
              <Link
                href="/alerts"
                className="text-[var(--text-dim)] text-xs tracking-[0.15em] uppercase py-2 border-b border-transparent hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
              >
                Alerts
              </Link>
            </nav>
          </header>

          <main className="flex-1 flex flex-col justify-center gap-10">
            <div className="flex flex-col gap-2">
              <p
                className="text-[0.6rem] tracking-[0.35em] text-[var(--text-muted)] animate-fadeSlideUp"
                style={{ animationDelay: "0.1s" }}
              >
                POLYMARKET SURVEILLANCE
              </p>
              <h1
                className="font-serif text-[clamp(3.5rem,14vw,6.5rem)] font-normal tracking-[0.02em] leading-[0.85] animate-fadeSlideUp"
                style={{ animationDelay: "0.2s" }}
              >
                ARGUS
              </h1>
              <p
                className="font-serif italic text-xl text-[var(--accent)] mt-2 animate-fadeSlideUp"
                style={{ animationDelay: "0.4s" }}
              >
                The All-Seeing Eye
              </p>
              <p
                className="text-sm leading-7 text-[var(--text-dim)] max-w-[320px] mt-3 animate-fadeSlideUp"
                style={{ animationDelay: "0.6s" }}
              >
                Autonomous detection of insider trading patterns across political prediction markets.
              </p>
            </div>

            <div
              className="flex gap-10 animate-fadeSlideUp"
              style={{ animationDelay: "0.8s" }}
            >
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-semibold flex items-center gap-2">
                  {markets === undefined ? (
                    <span className="animate-pulse">—</span>
                  ) : (
                    markets.length
                  )}
                </span>
                <span className="text-[0.6rem] tracking-[0.12em] uppercase text-[var(--text-muted)]">
                  Markets Monitored
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[0.8rem] tracking-[0.1em] text-[var(--accent)] font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.6)]" />
                  ACTIVE
                </span>
                <span className="text-[0.6rem] tracking-[0.12em] uppercase text-[var(--text-muted)]">
                  Detection Status
                </span>
              </div>
            </div>

            <Link
              href="/markets"
              className="inline-flex items-center gap-2 text-[var(--foreground)] text-xs tracking-[0.04em] py-3 border-t border-b border-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:pl-2 transition-all w-fit group animate-fadeSlideUp"
              style={{ animationDelay: "1s" }}
            >
              View Monitored Markets
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </main>

          <footer className="pt-8 animate-fadeSlideUp" style={{ animationDelay: "1.2s" }}>
            <p className="font-serif italic text-sm text-[var(--text-dim)] leading-6">
              &ldquo;He had a hundred eyes, of which only two would sleep at a time.&rdquo;
            </p>
            <p className="text-[0.65rem] text-[var(--text-muted)] mt-1 tracking-[0.08em]">
              — Ovid
            </p>
          </footer>
        </div>
      </div>

      {/* Right side - PixelBlast Eye (60%) */}
      <div className="w-[60%] min-h-screen relative">
        <PixelBlastEye className="absolute inset-0" />

        {/* Edge fade into content panel */}
        <div
          className="absolute top-0 left-0 w-[120px] h-full pointer-events-none z-[5]"
          style={{ background: "linear-gradient(90deg, var(--background) 0%, transparent 100%)" }}
        />

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
            background: "radial-gradient(ellipse at center, transparent 20%, var(--background) 80%)",
          }}
        />
      </div>
    </div>
  );
}
