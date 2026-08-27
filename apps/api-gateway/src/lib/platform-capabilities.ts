export type SupportedPlatform = 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'x' | 'linkedin';

type OfficialActionRequirement = {
  label: string;
  sourceUrl: string | null;
};

export type PlatformCapability = {
  platform: SupportedPlatform;
  label: string;
  officialPublishing: 'direct_post' | 'media_publish' | 'video_insert' | 'not_configured';
  creatorAccountRequirement: string;
  supportsDrafts: boolean;
  supportsScheduling: boolean;
  metricsStatus: 'planned' | 'available_after_connection';
  readiness: 'official_connector_ready' | 'connector_required';
  safeguards: string[];
  actionRequirements: OfficialActionRequirement[];
};

const capabilities: Record<SupportedPlatform, PlatformCapability> = {
  tiktok: {
    platform: 'tiktok', label: 'TikTok', officialPublishing: 'direct_post', creatorAccountRequirement: 'Creator-authorized TikTok account with approved Content Posting API access', supportsDrafts: true, supportsScheduling: false, metricsStatus: 'available_after_connection', readiness: 'connector_required', safeguards: ['Creator chooses audience and posting settings in the official flow.', 'Feed recommendation and reach remain controlled by TikTok.'], actionRequirements: [{ label: 'Use a registered app, creator-authorized access token, and the required Content Posting API scope.', sourceUrl: 'https://developers.tiktok.com/docs/en/content-posting-api-get-started' }, { label: 'Complete the platform audit before treating API-posted content as publicly visible.', sourceUrl: 'https://developers.tiktok.com/docs/en/content-posting-api-get-started' }],
  },
  instagram: {
    platform: 'instagram', label: 'Instagram', officialPublishing: 'media_publish', creatorAccountRequirement: 'Creator or business professional account with approved Instagram publishing permissions', supportsDrafts: false, supportsScheduling: false, metricsStatus: 'available_after_connection', readiness: 'connector_required', safeguards: ['Professional-account and permission requirements must be satisfied.', 'Publishing rate limits and media-hosting requirements apply.'], actionRequirements: [{ label: 'Use an eligible professional account and the required official content-publishing permission.', sourceUrl: 'https://developers.facebook.com/documentation/instagram-platform/content-publishing' }, { label: 'Complete Page Publishing Authorization when required and validate the publishing media-hosting requirement.', sourceUrl: 'https://developers.facebook.com/documentation/instagram-platform/content-publishing' }],
  },
  youtube: {
    platform: 'youtube', label: 'YouTube', officialPublishing: 'video_insert', creatorAccountRequirement: 'Creator-authorized YouTube channel with Data API upload permission', supportsDrafts: true, supportsScheduling: true, metricsStatus: 'available_after_connection', readiness: 'connector_required', safeguards: ['Visibility and schedule are creator-controlled channel settings.', 'YouTube recommendation and search ranking remain external.'], actionRequirements: [{ label: 'Obtain creator authorization with an official YouTube upload scope.', sourceUrl: 'https://developers.google.com/youtube/v3/docs/videos/insert' }, { label: 'Complete the required API project audit before treating an API upload as publicly visible.', sourceUrl: 'https://developers.google.com/youtube/v3/docs/videos/insert' }],
  },
  facebook: {
    platform: 'facebook', label: 'Facebook', officialPublishing: 'not_configured', creatorAccountRequirement: 'Creator-authorized Page or professional account and approved Meta permissions', supportsDrafts: false, supportsScheduling: false, metricsStatus: 'planned', readiness: 'connector_required', safeguards: ['No publishing is enabled until an official connector is implemented and tested.'], actionRequirements: [{ label: 'No certified official publishing connector is configured.', sourceUrl: null }],
  },
  x: {
    platform: 'x', label: 'X', officialPublishing: 'not_configured', creatorAccountRequirement: 'Creator-authorized X account with approved API access', supportsDrafts: false, supportsScheduling: false, metricsStatus: 'planned', readiness: 'connector_required', safeguards: ['No publishing is enabled until an official connector is implemented and tested.'], actionRequirements: [{ label: 'No certified official publishing connector is configured.', sourceUrl: null }],
  },
  linkedin: {
    platform: 'linkedin', label: 'LinkedIn', officialPublishing: 'not_configured', creatorAccountRequirement: 'Creator-authorized LinkedIn member or organization with approved API access', supportsDrafts: false, supportsScheduling: false, metricsStatus: 'planned', readiness: 'connector_required', safeguards: ['No publishing is enabled until an official connector is implemented and tested.'], actionRequirements: [{ label: 'Obtain member authorization with the required `w_member_social` scope.', sourceUrl: 'https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin' }, { label: 'Require the authenticated creator identity and an explicit visibility choice at the final action step.', sourceUrl: 'https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin' }],
  },
};

export function getPlatformCapability(platform: string) {
  return capabilities[platform as SupportedPlatform] ?? null;
}

export function listPlatformCapabilities() {
  return Object.values(capabilities);
}
