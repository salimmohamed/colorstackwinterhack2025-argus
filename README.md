# colorstackwinterhack2025-argus

**Argus** — An autonomous AI agent that monitors political prediction markets for insider trading patterns.

## Description

Argus is an AI-powered surveillance system that continuously monitors Polymarket's political prediction markets to detect suspicious trading activity that may indicate insider knowledge. Named after the hundred-eyed giant from Greek mythology, Argus watches market movements 24/7 and flags anomalous patterns for investigation.

The system uses Claude AI (via AWS Bedrock) to analyze trading patterns, identify high-risk accounts, and generate alerts when it detects potential insider trading signals such as:
- Large position changes before major news events
- Unusual win rates that exceed statistical probability
- Coordinated trading across multiple accounts
- Timing patterns that suggest advance knowledge

## Problem Alignment

Political prediction markets like Polymarket have become significant indicators of public sentiment, but they're vulnerable to manipulation by insiders with advance knowledge of political events. This undermines market integrity and public trust.

### Real-World Cases

**The Venezuela/Maduro Capture (January 2025)** — A single account made **$436,000 from a $32,537 bet** on Maduro being ousted, placing the wager hours before Trump announced the Venezuelan leader was in US custody. The account had joined Polymarket just weeks prior with only 4 positions—all on Venezuela. Market odds jumped from 6.5% to 11% in the hours before the announcement, indicating traders had advance knowledge of the US operation. Congressman Ritchie Torres has since introduced legislation to ban government employees from trading on prediction markets with material nonpublic information.

**The Google Insider "AlphaRaccoon" (2025)** — A trader made **over $1 million in 24 hours** by correctly predicting 22 out of 23 Google Year in Search rankings—outcomes so specific (exact ranking positions for obscure figures) that random accuracy is statistically impossible. The same trader previously made $150K by predicting the *exact release date* of Google's Gemini 3.0. The pattern suggests systematic access to insider information, yet prediction markets exist in a regulatory gray zone where insider trading laws don't clearly apply.

**The Israel/Iran Strike (2024-2025)** — A trader known as "ricosuave666" predicted the exact day Israel would strike Iran 7 months in advance and won **$154K**. The same account has since taken a massive position on another Israel strike by January 31, 2025, raising questions about potential intelligence community leaks.

These cases demonstrate the urgent need for automated surveillance tools that can detect suspicious patterns at scale—before insiders can profit from non-public information.

### How Argus Addresses This
1. **Autonomous Monitoring** — AI agent runs on a schedule, continuously analyzing market data without human intervention
2. **Pattern Recognition** — Identifies subtle signals that human reviewers might miss
3. **Transparent Flagging** — Generates detailed alerts with evidence and reasoning for each detection
4. **Account Risk Scoring** — Maintains profiles of flagged accounts with historical analysis

## Technologies Used

| Category | Technology |
|----------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Convex (serverless database + functions) |
| AI/ML | AWS Bedrock (Claude 3.5 Sonnet) |
| Data Source | Polymarket Gamma API |
| Language | TypeScript |
| Styling | CSS Variables, Custom animations |

## Setup & Installation

### Prerequisites
- Node.js 18+
- Bun (recommended) or npm
- AWS account with Bedrock access
- Convex account

### 1. Clone the repository
```bash
git clone https://github.com/salimmohamed/colorstackwinterhack2025-argus.git
cd colorstackwinterhack2025-argus
```

### 2. Install dependencies
```bash
bun install
# or
npm install
```

### 3. Set up environment variables

Create a `.env.local` file:
```env
# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url

# AWS Bedrock (for AI agent)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### 4. Initialize Convex
```bash
npx convex dev
```

### 5. Run the development server
```bash
bun dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### 6. Sync market data
Navigate to the Markets page and click "Sync Markets" to pull data from Polymarket.

## Features

- **Live Market Dashboard** — View monitored political prediction markets with real-time pricing
- **Detection Alerts** — Browse AI-generated alerts with severity levels and evidence
- **Flagged Accounts** — Track suspicious accounts with risk scores and trading history
- **Autonomous Agent** — Scheduled cron jobs run the AI agent every 15 minutes
- **Auto-Sync** — Market data refreshes automatically every 30 minutes

## Team Members & Contributions

| Member | Contributions |
|--------|---------------|
| Salim Mohamed | Full-stack development, AI agent implementation, UI/UX design |

## Demo

### Demo Video
[Link to demo video]

### Screenshots

**Home Page — The All-Seeing Eye**
![Home Page](screenshots/home.png)

**Markets Dashboard**
![Markets](screenshots/markets.png)

**Detection Alerts**
![Alerts](screenshots/alerts.png)

**Flagged Accounts**
![Accounts](screenshots/accounts.png)

---

*"He had a hundred eyes, of which only two would sleep at a time."* — Ovid
