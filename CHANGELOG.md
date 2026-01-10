# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-09

### Added

- **Core Platform**
  - Initial project setup with Next.js 15 and React 19
  - Convex serverless database with live queries for real-time updates
  - AWS Bedrock integration for Claude AI capabilities

- **Market Data**
  - Polymarket sync endpoint to fetch prediction market data
  - Automatic syncing of top political events from Polymarket
  - Support for Yes/No binary markets and multi-outcome markets

- **User Interface**
  - Argus-themed dark UI with ASCII art branding
  - Halftone eye landing page with PixelBlast visual effect
  - Markets dashboard to view monitored prediction markets
  - Responsive design with Tailwind CSS

- **Documentation**
  - Comprehensive README with setup instructions
  - Real-world insider trading case studies (Maduro, AlphaRaccoon, ricosuave666)

### Fixed

- Filter out placeholder markets and extract proper candidate names
- Limit market outcomes to top 5 candidates for cleaner display
- Correct eye animation rendering on landing page

### Changed

- Migrated from SvelteKit to Next.js for better React ecosystem support

---

## Version History

- **0.1.0** - Initial public release with core market monitoring functionality
- **0.0.1** - Internal development version

[Unreleased]: https://github.com/salimmohamed/colorstackwinterhack2025-argus/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/salimmohamed/colorstackwinterhack2025-argus/releases/tag/v0.1.0
