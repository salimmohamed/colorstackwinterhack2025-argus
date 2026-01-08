"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Link from "next/link";
import { FlickeringGrid } from "@/components/ui/flickering-grid";

export default function Home() {
  const markets = useQuery(api.markets.listActive, {});

  return (
    <div className="min-h-screen relative flex">
      {/* Left side - Text content (40%) */}
      <div className="w-[40%] min-h-screen relative z-10 bg-[var(--background)]">
        {/* Gradient fade to grid */}
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--background)] to-transparent z-20" />

        <div className="flex flex-col min-h-screen p-12 pr-16">
          <header className="mb-8">
            <nav>
              <Link
                href="/markets"
                className="text-[var(--text-dim)] text-xs tracking-[0.15em] uppercase py-2 border-b border-transparent hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
              >
                Markets
              </Link>
            </nav>
          </header>

          <main className="flex-1 flex flex-col justify-center gap-10">
            <div className="flex flex-col gap-2">
              <p className="text-[0.6rem] tracking-[0.35em] text-[var(--text-muted)]">
                POLYMARKET SURVEILLANCE
              </p>
              <h1 className="font-serif text-[clamp(3.5rem,14vw,6.5rem)] font-normal tracking-[0.02em] leading-[0.85]">
                ARGUS
              </h1>
              <p className="font-serif italic text-xl text-[var(--accent)] mt-2">
                The All-Seeing Eye
              </p>
              <p className="text-sm leading-7 text-[var(--text-dim)] max-w-[320px] mt-3">
                Autonomous detection of insider trading patterns
                across political prediction markets. Some eyes sleep
                while others watch.
              </p>
            </div>

            <div className="flex gap-10">
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
                  <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
                  ACTIVE
                </span>
                <span className="text-[0.6rem] tracking-[0.12em] uppercase text-[var(--text-muted)]">
                  Detection Status
                </span>
              </div>
            </div>

            <Link
              href="/markets"
              className="inline-flex items-center gap-2 text-[var(--foreground)] text-xs tracking-[0.04em] py-3 border-t border-b border-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:pl-2 transition-all w-fit group"
            >
              View Monitored Markets
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </main>

          <footer className="pt-8">
            <p className="font-serif italic text-sm text-[var(--text-dim)] leading-6">
              &ldquo;He had a hundred eyes, of which only two would sleep at a time.&rdquo;
            </p>
            <p className="text-[0.65rem] text-[var(--text-muted)] mt-1 tracking-[0.08em]">
              — Ovid
            </p>
          </footer>
        </div>
      </div>

      {/* Right side - Flickering Grid with Eye (60%) */}
      <div className="w-[60%] min-h-screen relative">
        <FlickeringGrid
          className="absolute inset-0"
          squareSize={4}
          gridGap={6}
          color="#f59e0b"
          maxOpacity={0.5}
          flickerChance={0.1}
          maskPattern="eye"
        />

        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
    </div>
  );
}
