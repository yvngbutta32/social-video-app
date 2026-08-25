export const supportedGrowthPlatforms = ['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin'] as const;

export type GrowthPlatform = (typeof supportedGrowthPlatforms)[number];
export type GrowthObjective = 'views' | 'engagement' | 'followers' | 'retention';

export type GrowthExperimentPlan = {
  platform: GrowthPlatform;
  variantType: 'organic_experiment';
  aspectRatio: '9:16' | '1:1' | '16:9';
  hook: string;
  caption: string;
  hypothesis: string;
  learningQuestion: string;
  recommendedWindow: string;
  changes: string[];
  safeguards: string[];
};

const platformDetails: Record<GrowthPlatform, {
  aspectRatio: GrowthExperimentPlan['aspectRatio'];
  hookPrefix: string;
  captionPrefix: string;
  window: string;
  learningQuestion: string;
  changes: string[];
}> = {
  tiktok: {
    aspectRatio: '9:16',
    hookPrefix: 'The part nobody tells you about',
    captionPrefix: 'A practical perspective on',
    window: 'Next high-attention evening window',
    learningQuestion: 'Does a direct contrarian opener increase qualified watch-through for this creator?',
    changes: ['Open with the contrarian claim in the first second', 'Use large native captions', 'Keep the proof sequence under 30 seconds'],
  },
  instagram: {
    aspectRatio: '9:16',
    hookPrefix: 'A better way to think about',
    captionPrefix: 'Save this perspective on',
    window: 'Next creator-specific morning save window',
    learningQuestion: 'Does an outcome-led framing improve saves and shares for this creator?',
    changes: ['Show the outcome before the explanation', 'Use an editable caption with a clear takeaway', 'End with a save-oriented call to action'],
  },
  youtube: {
    aspectRatio: '9:16',
    hookPrefix: 'Three things I changed about',
    captionPrefix: 'A concise breakdown of',
    window: 'Next creator-specific midday discovery window',
    learningQuestion: 'Does a list-led structure improve completion while preserving the creator’s voice?',
    changes: ['State the list promise immediately', 'Use visible chapter beats', 'Reserve the final point for the payoff'],
  },
  facebook: {
    aspectRatio: '1:1',
    hookPrefix: 'What changed when I rethought',
    captionPrefix: 'A useful note on',
    window: 'Next creator-specific community window',
    learningQuestion: 'Does a personal-context opening increase meaningful discussion for this creator?',
    changes: ['Use a community-oriented opening line', 'Include contextual caption copy', 'Invite relevant discussion without engagement bait'],
  },
  x: {
    aspectRatio: '1:1',
    hookPrefix: 'A short lesson about',
    captionPrefix: 'A short lesson on',
    window: 'Next creator-specific conversation window',
    learningQuestion: 'Does a concise point-of-view framing earn more quality replies for this creator?',
    changes: ['Lead with a clear point of view', 'Keep the companion copy concise', 'Use a single concrete takeaway'],
  },
  linkedin: {
    aspectRatio: '16:9',
    hookPrefix: 'The operating lesson behind',
    captionPrefix: 'An operating lesson from',
    window: 'Next creator-specific professional-attention window',
    learningQuestion: 'Does an applied insight framing create more qualified professional engagement?',
    changes: ['Frame the opening as an operating insight', 'Make the proof practical', 'Close with an explicit lesson'],
  },
};

function normalizeTitle(title: string | null | undefined) {
  const compact = title?.replace(/\s+/g, ' ').trim();
  return compact && compact.length > 0 ? compact : 'this original idea';
}

function limitText(value: string, maximum = 110) {
  return value.length > maximum ? `${value.slice(0, maximum - 1).trimEnd()}…` : value;
}

export function buildGrowthExperimentPlan(input: {
  sourceTitle?: string | null;
  platforms: GrowthPlatform[];
  objective: GrowthObjective;
  transcript?: string | null;
}): GrowthExperimentPlan[] {
  const source = normalizeTitle(input.sourceTitle);
  const sourcePhrase = limitText(source, 76);
  const objectivePhrase: Record<GrowthObjective, string> = {
    views: 'early qualified attention',
    engagement: 'meaningful engagement',
    followers: 'relevant follower growth',
    retention: 'watch-through and completion',
  };

  return [...new Set(input.platforms)].map((platform) => {
    const detail = platformDetails[platform];
    const transcriptSignal = input.transcript?.trim().slice(0, 80);
    const hook = `${detail.hookPrefix} ${sourcePhrase}`;

    return {
      platform,
      variantType: 'organic_experiment',
      aspectRatio: detail.aspectRatio,
      hook,
      caption: `${detail.captionPrefix} ${sourcePhrase}. The goal is to test for ${objectivePhrase[input.objective]} while staying true to the original point of view.`,
      hypothesis: `For ${platform}, adapting “${sourcePhrase}” with a platform-native opening and a focused proof sequence may improve ${objectivePhrase[input.objective]} relative to the creator’s recent baseline.`,
      learningQuestion: detail.learningQuestion,
      recommendedWindow: detail.window,
      changes: transcriptSignal ? [...detail.changes, `Preserve the source language: “${transcriptSignal}…”`] : detail.changes,
      safeguards: [
        'This is an organic experiment, not a guarantee of distribution or virality.',
        'The creator retains approval before any version is queued for publishing.',
        'Performance results should be evaluated against the creator’s own recent baseline.',
      ],
    };
  });
}
