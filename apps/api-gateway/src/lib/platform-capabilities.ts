export type SupportedPlatform = 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'x' | 'linkedin';

type PlatformCapability = {
  platform: SupportedPlatform;
  label: string;
  officialPublishing: 'direct_post' | 'media_publish' | 'video_insert' | 'not_configured';
  creatorAccountRequirement: string;
  supportsDrafts: boolean;
  supportsScheduling: boolean;
  metricsStatus: 'planned' | 'available_after_connection';
  readiness: 'official_connector_ready' | 'connector_required';
  safeguards: string[];
};

const capabilities: Record<SupportedPlatform, PlatformCapability> = {
  tiktok: {
    platform: 'tiktok', label: 'TikTok', officialPublishing: 'direct_post', creatorAccountRequirement: 'Creator-authorized TikTok account with approved Content Posting API access', supportsDrafts: true, supportsScheduling: false, metricsStatus: 'available_after_connection', readiness: 'connector_required', safeguards: ['Creator chooses audience and posting settings in the official flow.', 'Feed recommendation and reach remain controlled by TikTok.'],
  },
  instagram: {
    platform: 'instagram', label: 'Instagram', officialPublishing: 'media_publish', creatorAccountRequirement: 'Creator or business professional account with approved Instagram publishing permissions', supportsDrafts: false, supportsScheduling: false, metricsStatus: 'available_after_connection', readiness: 'connector_required', safeguards: ['Professional-account and permission requirements must be satisfied.', 'Publishing rate limits and media-hosting requirements apply.'],
  },
  youtube: {
    platform: 'youtube', label: 'YouTube', officialPublishing: 'video_insert', creatorAccountRequirement: 'Creator-authorized YouTube channel with Data API upload permission', supportsDrafts: true, supportsScheduling: true, metricsStatus: 'available_after_connection', readiness: 'connector_required', safeguards: ['Visibility and schedule are creator-controlled channel settings.', 'YouTube recommendation and search ranking remain external.'],
  },
  facebook: {
    platform: 'facebook', label: 'Facebook', officialPublishing: 'not_configured', creatorAccountRequirement: 'Creator-authorized Page or professional account and approved Meta permissions', supportsDrafts: false, supportsScheduling: false, metricsStatus: 'planned', readiness: 'connector_required', safeguards: ['No publishing is enabled until an official connector is implemented and tested.'],
  },
  x: {
    platform: 'x', label: 'X', officialPublishing: 'not_configured', creatorAccountRequirement: 'Creator-authorized X account with approved API access', supportsDrafts: false, supportsScheduling: false, metricsStatus: 'planned', readiness: 'connector_required', safeguards: ['No publishing is enabled until an official connector is implemented and tested.'],
  },
  linkedin: {
    platform: 'linkedin', label: 'LinkedIn', officialPublishing: 'not_configured', creatorAccountRequirement: 'Creator-authorized LinkedIn member or organization with approved API access', supportsDrafts: false, supportsScheduling: false, metricsStatus: 'planned', readiness: 'connector_required', safeguards: ['No publishing is enabled until an official connector is implemented and tested.'],
  },
};

export function getPlatformCapability(platform: string) {
  return capabilities[platform as SupportedPlatform] ?? null;
}

export function listPlatformCapabilities() {
  return Object.values(capabilities);
}
