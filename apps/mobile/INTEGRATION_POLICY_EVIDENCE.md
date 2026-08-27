# Official Integration Policy Evidence

**Research date:** August 26, 2026

## Verified primary-source findings

| Platform | Official source | Verified finding | Product implication |
|---|---|---|---|
| TikTok | [Content Posting API — Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-get-started) | TikTok states that posts from unaudited clients are restricted to private viewing; lifting the restriction requires a Content Posting API audit. The integration requires a registered app, the appropriate scope, a creator access token, and post-status handling. | ViralBoost must retain a connection-required and creator-approval boundary. It must not represent a prepared TikTok draft as a public post or claim public distribution before audit and an authorized action succeed. |
| Instagram | [Instagram Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing) | Meta documents publishing for Instagram professional accounts, requires an appropriate access token and content-publishing permission, and notes that Page Publishing Authorization can block publishing. Media must be hosted on a publicly accessible server when publishing. | ViralBoost can prepare private artifacts, but an Instagram publishing workflow must validate official account eligibility, permissions, authorization state, media-hosting requirements, and a creator-confirmed action before declaring an action available. |
| YouTube | [YouTube Data API `videos.insert`](https://developers.google.com/youtube/v3/docs/videos/insert) | Upload requires an OAuth scope including `youtube.upload`; uploads from unverified API projects are restricted to private viewing until the project completes an audit. The API also documents upload size and quota constraints. | A connected channel is insufficient proof of publish readiness. ViralBoost must validate an authorized upload scope, project-audit status, and action-time upload result before describing a video as uploaded or public. |
| LinkedIn | [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) | Creating a member post requires `w_member_social`, acts for the authenticated member identified as the author, and requires an explicit visibility setting. | ViralBoost must present the creator’s LinkedIn identity and visibility choice in a final confirmation flow; target selection alone cannot authorize a LinkedIn post. |

## Preliminary decision boundary

The existing connection status UI is directionally correct but cannot be treated as a publishing readiness guarantee. A connected account and a platform capability declaration are separate from the platform-specific audit, scope, account, media-hosting, visibility, and action-time requirements that the official providers impose.
