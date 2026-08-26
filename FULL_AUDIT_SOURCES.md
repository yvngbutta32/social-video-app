# Full Application Audit Sources

## Dependency audit evidence

On August 26, 2026, `npm audit --omit=dev --json` reported no production dependency vulnerabilities for `apps/api-gateway`.

The same command reported three vulnerable dependency groups for `apps/web`: one critical direct `next` finding and high-severity `nanoid` and `postcss` findings. The audit reported a non-major upgrade path to `next@14.2.35` for the Next.js and nested PostCSS findings. The audit output is preserved at `/home/ubuntu/audit-artifacts/web-npm-audit.json` for the full advisory IDs and version ranges.

## Competitor benchmark sources

- [Hootsuite official product page](https://www.hootsuite.com/) describes a connected suite for trend tracking, social intelligence, content creation, engagement, analytics, competitive monitoring, and employee advocacy.
- [Sprout Social official product page](https://sproutsocial.com/) describes real-time social intelligence, publishing, channel integrations, influencer workflows, and team operations.
- [OpusClip official video repurposing page](https://www.opus.pro/tools/video-repurposing-tool) describes AI segmentation, platform adaptation, editing, automatic subtitles, branding, and direct sharing.

## Security and provider references

- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [TikTok Content Posting API](https://developers.tiktok.com/products/content-posting-api/)
- [Instagram Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
- [YouTube Data API videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert)
