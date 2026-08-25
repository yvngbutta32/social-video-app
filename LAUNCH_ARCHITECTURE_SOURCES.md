
## Official platform constraints gathered

TikTok’s official Content Posting API supports creator-authorized Direct Post and Upload to TikTok draft workflows. Direct Post exposes TikTok posting settings to the creator; Upload sends content as a draft for further editing and posting in TikTok’s creation flow. Source: https://developers.tiktok.com/products/content-posting-api/

Instagram’s official Content Publishing documentation, updated June 30, 2026, describes publishing images, videos, reels, and carousel posts for Instagram professional accounts. It requires an appropriate Meta login flow, creator authorization, server-hosted media reachable by Meta at publishing time, and webhooks for production implementations. It documents media-container creation, media publishing, status checks, rate-limit checks, and resumable upload paths. Source: https://developers.facebook.com/documentation/instagram-platform/content-publishing

YouTube’s official `videos.insert` documentation describes authenticated uploads through the YouTube Data API. It requires an upload-capable OAuth scope, accepts video media, supports status/privacy/scheduling metadata, and notes that uploads from unverified API projects created after July 28, 2020 are restricted to private viewing until the API project passes an audit. Source: https://developers.google.com/youtube/v3/docs/videos/insert
