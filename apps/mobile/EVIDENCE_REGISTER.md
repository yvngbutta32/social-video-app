# ViralBoost Evidence Register

This register records the evidence used to guide major product behavior, UX decisions, platform claims, and marketing boundaries. A feature should not be described as production-ready until its evidence and deterministic tests are recorded.

| Decision or claim | Evidence basis | Strength | Implementation boundary |
|---|---|---:|---|
| Timed-caption editing is a valid creator workflow need | CHI 2024 mixed-method study with 17 creator interviews and a 12-person participatory design workshop; findings include automated highlight generation and creator-control concerns. | Medium-high | Provide editable cues, preserve creator control, show confidence/uncertainty, and never imply automatic text is perfect. |
| Caption tracks are a real platform artifact | YouTube Data API documentation describes caption resources and methods to list, insert, update, download, and delete tracks. | High for YouTube | Treat captions as provider-specific actions; do not assume every platform exposes the same caption-track API. |
| TikTok publishing must use authorized APIs and comply with platform guidelines | TikTok Content Posting API product and content-sharing documentation. | High | Require official authorization, explicit creator approval, provider capability checks, and reconciliation. |
| Instagram publishing is provider-specific | Meta Instagram Content Publishing documentation supports publishing images, videos, Reels, and carousel posts through its platform APIs. | High | Keep Instagram capability state explicit; no generic “publish everywhere” promise. |
| Creator operational tooling is commercially relevant | IAB 2025 Creator Economy Ad Spend & Strategy Report projects $37B U.S. creator ad spend in 2025 and identifies measurement, standards, and operational tools as opportunity areas. | High for market signal | Build measurement and workflow operations, not guaranteed reach claims. |
| Cross-platform creator work creates stress and visibility uncertainty | LSE longitudinal ethnographic research identifies stress, burnout, precarity, and algorithmic discrimination affecting creators, especially smaller creators. | Medium-high | Reduce repetitive operational work while keeping actions transparent and creator-approved. |
| Guaranteed views or feed placement cannot be claimed | Platform recommendation systems, eligibility, and distribution remain controlled by third parties; existing repository policy evidence and official API boundaries do not provide a guarantee mechanism. | High for claims boundary | Marketing must say “improves preparation and measurement” rather than “guarantees virality.” |

## References

1. https://dl.acm.org/doi/abs/10.1145/3613904.3642476 — Unlocking Creator-AI Synergy: Challenges, Requirements, and Design Opportunities in AI-Powered Short-Form Video Production.
2. https://developers.google.com/youtube/v3/docs/captions — YouTube Data API Captions resource.
3. https://developers.google.com/youtube/v3/guides/implementation/captions — YouTube caption implementation guide.
4. https://developers.tiktok.com/products/content-posting-api/ — TikTok Content Posting API.
5. https://developers.tiktok.com/doc/content-sharing-guidelines — TikTok Content Sharing Guidelines.
6. https://developers.facebook.com/documentation/instagram-platform/content-publishing — Meta Instagram Content Publishing.
7. https://www.iab.com/insights/2025-creator-economy-ad-spend-strategy-report/ — IAB 2025 Creator Economy Ad Spend & Strategy Report.
8. https://eprints.lse.ac.uk/115384 — Cross-platform labor and precarity in the online video influencer industry.

## Milestone validation record

The native timed-caption contract and Edit Lab integration passed 23 Vitest files with 56 tests, TypeScript, and Expo lint. The official-action contract passed its pinned API gateway verifier and targeted ESLint validation. The processor worker render-filter contract passed, the worker now has a native ESLint 9 configuration, and its deterministic Vitest suite passes 3 tests. The worker configuration isolates pre-existing unused-variable and browser-global debt in legacy processor/publisher files; that debt remains explicitly tracked rather than being represented as resolved. The API gateway-wide TypeScript check remains blocked by 33 pre-existing implicit-any errors in unrelated routes and libraries.
