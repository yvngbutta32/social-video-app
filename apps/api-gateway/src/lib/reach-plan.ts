export type ReachPlatform = 'tiktok' | 'instagram' | 'youtube';
export type ReachObjective = 'views' | 'engagement' | 'followers' | 'retention';

type ReachPlanInput = {
  sourceTitle: string | null;
  platforms: ReachPlatform[];
  objective: ReachObjective;
  activeDestinations: number;
};

export function buildReachPlan(input: ReachPlanInput) {
  const platforms = [...new Set(input.platforms)];
  const primary = platforms[0] ?? 'tiktok';
  const steps = [
    {
      id: 'native-seed',
      sequence: 1,
      type: 'creator_authorized_publish',
      title: 'Seed the strongest native version',
      action: `Prepare the ${primary} version for creator review and publish through its official creator-authorized capability.`,
      purpose: 'Establish a clean first measurement point using the source’s strongest opening and platform-native treatment.',
      checkpoint: 'Confirm delivery, first-hour views, retention, comments, shares, and saves where the platform reports them.',
    },
    {
      id: 'native-syndication',
      sequence: 2,
      type: 'authorized_cross_platform',
      title: 'Syndicate only approved native adaptations',
      action: platforms.length > 1
        ? `Release the approved adaptations to ${platforms.slice(1).join(', ')} in separate creator-approved windows.`
        : 'Keep the first test focused on one destination until its signal is measurable.',
      purpose: 'Compare platform-native treatments without treating one platform’s outcome as a promise on another.',
      checkpoint: 'Compare normalized retention and meaningful engagement against this creator’s own baseline.',
    },
    {
      id: 'share-loop',
      sequence: 3,
      type: 'creator_owned_share_loop',
      title: 'Activate voluntary sharing surfaces',
      action: 'Prepare a concise share prompt, reply prompts, profile continuation, and a follow-up post that the creator may use with their existing audience.',
      purpose: 'Give real viewers a reason to continue the conversation or share the idea without manufactured engagement.',
      checkpoint: 'Track qualified replies, shares, profile actions, and follow-on content rather than raw impressions alone.',
    },
    {
      id: 'collaboration',
      sequence: 4,
      type: 'creator_approved_collaboration',
      title: 'Package an optional collaboration ask',
      action: 'Generate a short, personalized collaboration brief for creators or communities selected and contacted by the creator.',
      purpose: 'Create legitimate distribution opportunities through relevant people and communities.',
      checkpoint: 'Record outreach consent, response quality, resulting co-created assets, and attributable traffic.',
    },
    {
      id: 'learning-gate',
      sequence: 5,
      type: 'evidence_checkpoint',
      title: 'Decide from evidence, not hype',
      action: `Collect enough observations for the ${input.objective} objective before retaining, revising, or stopping the hypothesis.`,
      purpose: 'Use the creator’s own data to improve the next experiment instead of assuming a single post generalizes.',
      checkpoint: 'Continue collecting when the sample is insufficient; do not call a winner from early noise.',
    },
  ];

  return {
    sourceTitle: input.sourceTitle ?? 'Untitled source',
    objective: input.objective,
    platforms,
    activeDestinations: input.activeDestinations,
    steps,
    safeguards: [
      'All publishing and collaboration actions require creator authorization.',
      'This plan does not buy reach, create fake engagement, or control platform ranking.',
      'Planned distribution is not confirmed delivery, and confirmed delivery is not guaranteed reach.',
      'Each checkpoint should be evaluated against the creator workspace baseline.',
    ],
  };
}
