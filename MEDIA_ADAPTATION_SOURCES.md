# Media Adaptation Research Sources

**Purpose:** Verified external constraints used to bound ViralBoost’s platform-native media recipes. These are provider delivery requirements, not guarantees of platform ranking, reach, views, likes, followers, or virality.

| Platform | Verified constraint relevant to the product contract | Primary source |
|---|---|---|
| TikTok | The official Content Posting API media-transfer guide lists MP4, WebM, and MOV as supported upload formats; it recommends H.264 and documents frame-rate constraints. Any future delivery connector must validate against the creator account’s official `creator_info` capability response rather than assume universal posting eligibility. | [TikTok Media Transfer Guide](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide?enter_method=left_navigation) |
| Instagram | Meta’s Instagram publishing documentation applies account, permission, publishing, and rate-limit restrictions. The official media reference identifies H.264 or HEVC video and describes media constraints; a future connector must validate the current official response rather than hard-code assumptions. | [Instagram Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing), [IG User Media Reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media) |
| YouTube | The official YouTube Data API supports resumable video uploads. ViralBoost should use official account authorization and upload status rather than infer a ranking or Shorts placement outcome from export properties. | [YouTube Data API: Upload a Video](https://developers.google.com/youtube/v3/guides/uploading_a_video) |

## Design implications

The editable adaptation recipe should remain platform-neutral and preserve the original asset. It can express clip boundaries, target composition, caption treatment, headline text, safe-zone preference, audio treatment, and source provenance. The render worker must convert this recipe into FFmpeg parameters and validate the resulting artifact before it is marked ready. Provider-specific delivery validation remains a separate official-connector boundary.

## Current worker evidence

The existing local processor defines platform layout specifications, FFmpeg transcodes, audio normalization, thumbnail generation, scene-detection attempts, timed-caption generation attempts, and workspace-owned object output. However, its current `viral_optimize` naming is not evidence of a predictive ranking model; it must not be described as one. The current worker does not yet apply non-destructive creator trim/caption/crop recipes to rerendered output, and real execution is still pending persistent-host validation.

## Creator-first adaptation and editing research

| Evidence | Product decision |
|---|---|
| The PodReels human-AI co-creation study describes selection as a major creator burden and reports that candidate clips, editable sentence-level refinement, and creator control can reduce mental demand and improve teaser-production efficiency. Its core lesson is not that automation predicts fame; it is that the product should propose several traceable candidates and retain creator control over selection and refinement. | ViralBoost should generate a small ranked set of editable clip candidates from scenes, captions, and source structure. Every suggestion needs a reason, a source time range, and a non-destructive edit recipe that a creator can change or reject. |
| TikTok’s official media-transfer guide documents supported upload formats, codecs, duration, pixel, size, chunking, rate-limit, authorization, and domain-ownership constraints. | Export recipes must be validated before connector delivery. Distribution remains a separate creator-authorized provider boundary; export success does not imply posting success or reach. |
| Meta’s official Instagram publishing guide requires a professional-account authorization path, media-container flow, status polling, public media accessibility for certain flows, and publishing-rate awareness. | The renderer must produce a private artifact first, then an official connector can create/poll a provider container only after creator approval. Creator media must not be exposed publicly merely for preview. |
| YouTube’s official upload guide uses OAuth, resumable upload, explicit metadata, privacy status, and retry handling. | ViralBoost must keep creation and publishing distinct: a creator can export or review a private/unlisted artifact without treating it as published or assuming a Shorts/recommendation outcome. |

### Product-contract implications

The primary product loop should be **Upload → Analyze → Receive candidate clips → Choose or refine → Render → Review/export → Optional creator-authorized publishing → Measure → Learn**. Beginning creators should be able to accept a recommended clip set with one clear choice per platform. Advanced creators should be able to modify a non-destructive recipe: source range, crop/composition mode, caption toggle and style, headline, aspect ratio/export platform, audio treatment, and safe-zone overlay. The original source must remain unchanged and every rendered artifact must retain source provenance.

The first implementation milestone should deliberately avoid claims of automatic “best” clips. It should create **evidence-backed candidate clips** based on locally available scene boundaries, transcript/caption segments, source duration, and platform specification constraints, then label the selection method and confidence. A later learned-ranking model can be trained only after permissioned outcome data exists and must be evaluated against creator-specific baselines.

### Additional sources

- [PodReels: Human-AI Co-Creation of Video Podcast Teasers](https://doi.org/10.1145/3643834.3661591)
- [TikTok Content Posting API Media Transfer Guide](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide?enter_method=left_navigation)
- [Instagram Platform Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
- [YouTube Data API: Upload a Video](https://developers.google.com/youtube/v3/guides/uploading_a_video)
