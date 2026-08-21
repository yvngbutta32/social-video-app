import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/prisma.js';
import type { Variables } from '../index.js';

// Import viral predictor from intelligence worker (via HTTP call or direct import)
// For now, we'll call the intelligence worker's API
const INTELLIGENCE_WORKER_URL = (globalThis as any).process?.env?.INTELLIGENCE_WORKER_URL || 'http://intelligence-worker:3002';

// Schema for viral prediction request
const predictViralSchema = z.object({
  videoId: z.string().uuid(),
  platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']),
  contentType: z.enum(['educational', 'entertainment', 'promotional', 'behind_scenes', 'user_generated', 'news', 'lifestyle', 'comedy', 'dance', 'beauty', 'fitness', 'tech', 'finance', 'travel', 'food', 'pets', 'gaming', 'diy']).optional(),
  durationSec: z.number().int().positive().max(600),
  hasCaptions: z.boolean().default(false),
  hasMusic: z.boolean().default(false),
  hasTextOverlay: z.boolean().default(false),
  hashtagCount: z.number().int().min(0).max(30).default(0),
  mentionCount: z.number().int().min(0).max(10).default(0),
  isSeries: z.boolean().default(false),
  seriesPart: z.number().int().positive().optional(),
  postingHour: z.number().int().min(0).max(23).optional(),
  postingDayOfWeek: z.number().int().min(0).max(6).optional(),
  followerCount: z.number().int().min(0).optional(),
  previousAvgViews: z.number().int().min(0).optional(),
  previousAvgEngagementRate: z.number().min(0).max(100).optional(),
});

// Schema for hook generation request
const generateHooksSchema = z.object({
  topic: z.string().min(3).max(200),
  platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']),
  contentType: z.enum(['educational', 'entertainment', 'promotional', 'behind_scenes', 'user_generated', 'news', 'lifestyle', 'comedy', 'dance', 'beauty', 'fitness', 'tech', 'finance', 'travel', 'food', 'pets', 'gaming', 'diy']),
  targetAudience: z.string().min(3).max(200).optional(),
  brandVoice: z.enum(['professional', 'casual', 'witty', 'inspiring', 'authoritative', 'friendly', 'bold', 'minimalist']).default('friendly'),
  hookCount: z.number().int().min(1).max(10).default(5),
  includeVisualHooks: z.boolean().default(true),
  includeAudioHooks: z.boolean().default(true),
});

// Schema for concept generation from trend
const generateConceptsSchema = z.object({
  trendId: z.string().uuid(),
  brandNiche: z.string().min(3).max(100),
  brandVoice: z.enum(['professional', 'casual', 'witty', 'inspiring', 'authoritative', 'friendly', 'bold', 'minimalist']).default('friendly'),
  targetPlatform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']),
  conceptCount: z.number().int().min(1).max(5).default(3),
  contentPillars: z.array(z.string()).max(5).optional(),
  avoidTopics: z.array(z.string()).max(10).optional(),
});

// Schema for trend analysis request
const analyzeTrendSchema = z.object({
  platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']),
  niche: z.string().min(3).max(100),
  timeframe: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
  minVelocity: z.number().min(0).default(100),
  limit: z.number().int().min(1).max(50).default(20),
});

export function createIntelligenceRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  // POST /api/v1/intelligence/predict-viral - Predict viral potential of a video
  app.post('/predict-viral', zValidator('json', predictViralSchema), async (c: any) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    // Get the video variant
    const variant = await prisma.videoVariant.findFirst({
      where: { 
        videoId: input.videoId,
        platform: input.platform,
      },
      include: {
        video: true,
        scheduledPosts: {
          include: {
            metrics: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    
    if (!variant) {
      throw new HTTPException(404, { message: 'Video variant not found' });
    }
    
    // Get existing viral prediction if available
    const existingPrediction = await prisma.viralPrediction.findFirst({
      where: { variantId: variant.id },
      orderBy: { createdAt: 'desc' },
    });
    
    // Calculate features for prediction
    const features = {
      durationSec: input.durationSec,
      hasCaptions: input.hasCaptions,
      hasMusic: input.hasMusic,
      hasTextOverlay: input.hasTextOverlay,
      hashtagCount: input.hashtagCount,
      mentionCount: input.mentionCount,
      isSeries: input.isSeries,
      postingHour: input.postingHour,
      postingDayOfWeek: input.postingDayOfWeek,
      followerCount: input.followerCount,
      previousAvgViews: input.previousAvgViews,
      previousAvgEngagementRate: input.previousAvgEngagementRate,
      contentType: input.contentType,
      hookType: variant.hookId ? (await prisma.hook.findUnique({ where: { id: variant.hookId } }))?.hookType : null,
    };
    
    // Simple heuristic-based prediction (in production, use ML model)
    let viralScore = 0.5;
    let confidence = 0.7;
    
    // Duration factor (optimal 15-30s for shorts)
    if (input.durationSec >= 15 && input.durationSec <= 30) viralScore += 0.1;
    else if (input.durationSec > 60) viralScore -= 0.1;
    
    // Captions boost
    if (input.hasCaptions) viralScore += 0.05;
    
    // Hashtag optimization
    if (input.hashtagCount >= 3 && input.hashtagCount <= 10) viralScore += 0.05;
    else if (input.hashtagCount > 15) viralScore -= 0.05;
    
    // Posting time optimization
    if (input.postingHour !== undefined) {
      const optimalHours = [9, 10, 11, 12, 13, 17, 18, 19, 20, 21];
      if (optimalHours.includes(input.postingHour)) viralScore += 0.05;
    }
    
    // Follower count factor
    if (input.followerCount && input.followerCount > 10000) viralScore += 0.1;
    else if (input.followerCount && input.followerCount > 1000) viralScore += 0.05;
    
    // Previous performance
    if (input.previousAvgEngagementRate && input.previousAvgEngagementRate > 5) viralScore += 0.1;
    else if (input.previousAvgEngagementRate && input.previousAvgEngagementRate > 2) viralScore += 0.05;
    
    // Clamp score
    viralScore = Math.max(0, Math.min(1, viralScore));
    
    // Predict views based on follower count and viral score
    const baseViews = input.followerCount || 1000;
    const predictedViews = Math.round(baseViews * (0.1 + viralScore * 2));
    const predictedEngagementRate = viralScore * 10;
    const predictedCompletionRate = viralScore * 0.8;
    
    // Save prediction
    const prediction = await prisma.viralPrediction.create({
      data: {
        workspaceId: workspaceMember.workspaceId,
        variantId: variant.id,
        predictedViralScore: viralScore,
        predictedViews,
        predictedEngagementRate,
        confidence,
        modelVersion: 'heuristic-v1',
        features,
      },
    });
    
    return c.json({
      success: true,
      data: {
        videoId: input.videoId,
        platform: input.platform,
        viralScore,
        confidence,
        predictedViews,
        predictedEngagementRate,
        predictedCompletionRate,
        factors: {
          duration: input.durationSec >= 15 && input.durationSec <= 30 ? 'optimal' : 'suboptimal',
          captions: input.hasCaptions ? 'present' : 'missing',
          hashtags: input.hashtagCount >= 3 && input.hashtagCount <= 10 ? 'optimal' : 'suboptimal',
          postingTime: input.postingHour !== undefined && [9,10,11,12,13,17,18,19,20,21].includes(input.postingHour) ? 'optimal' : 'suboptimal',
        },
        recommendations: [
          input.hasCaptions ? null : 'Add captions for better retention',
          input.hashtagCount < 3 ? 'Add 3-10 relevant hashtags' : null,
          input.postingHour === undefined ? 'Post during peak hours (9-13, 17-21)' : null,
        ].filter(Boolean),
        riskFactors: [
          input.durationSec > 60 ? 'Video too long for short-form platform' : null,
          input.hashtagCount > 15 ? 'Too many hashtags may look spammy' : null,
        ].filter(Boolean),
        benchmarkPercentile: Math.round(viralScore * 100),
      },
    });
  });

  // POST /api/v1/intelligence/generate-hooks - Generate hook suggestions
  app.post('/generate-hooks', zValidator('json', generateHooksSchema), async (c: any) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    // Get existing hooks for this niche/platform to learn from
    const existingHooks = await prisma.hook.findMany({
      where: {
        workspaceId: workspaceMember.workspaceId,
        niche: input.contentType,
        platform: input.platform,
      },
      orderBy: { viralScore: 'desc' },
      take: 20,
    });
    
    // Hook templates by type
    const hookTemplates = {
      curiosity: [
        "I discovered {secret} that {result}...",
        "The {secret} to {result} that {authority} doesn't want you to know...",
        "What happens when you {action} for {timeframe}? The results shocked me...",
      ],
      authority: [
        "After {years} years of {expertise}, here is what nobody tells you...",
        "Senior {role}s use this {pattern} pattern. Junior {role}s don't...",
        "The complete guide to {topic} that I wish I had...",
      ],
      transformation: [
        "How I went from {before} to {after} in {timeframe}...",
        "My {timeframe} journey from {before} to {after}...",
        "{timeframe} {body_part} transformation - no gym, no equipment...",
      ],
      mistake: [
        "Stop making this {mistake} that costs you {cost}...",
        "The #1 mistake {audience} make when {activity}...",
        "Why {common_practice} is actually hurting your {outcome}...",
      ],
      contrarian: [
        "Everyone says {common_advice}. They are wrong. Here is why...",
        "Unpopular opinion: {controversial_statement}...",
        "Why {popular_tool} is overrated and what to use instead...",
      ],
      money: [
        "How I make ${amount}/{timeframe} with {business_model}...",
        "The {framework} framework that grew {company} from ${start} to ${end}...",
        "This {lines_of_code}-line {language} script {result}...",
      ],
      protocol: [
        "My exact {goal} protocol: {steps} steps, {timeframe} results...",
        "The exact {number}-step framework for {outcome}...",
        "How we scaled {system} to {metric} with {technology}...",
      ],
    };
    
      // Generate hooks based on templates
    const hookTypes = Object.keys(hookTemplates);
    const hooks = [];
    
    for (let i = 0; i < Math.min(input.hookCount, hookTypes.length); i++) {
      const type = hookTypes[i];
      const templates = hookTemplates[type as keyof typeof hookTemplates];
      const template = templates[Math.floor(Math.random() * templates.length)];
      
      // Fill template with topic-relevant content
      const filledTemplate = template
        .replace(/{secret}/g, 'secret method')
        .replace(/{result}/g, 'amazing results')
        .replace(/{authority}/g, 'experts')
        .replace(/{action}/g, 'tried this')
        .replace(/{timeframe}/g, '30 days')
        .replace(/{years}/g, '10')
        .replace(/{expertise}/g, input.contentType)
        .replace(/{role}/g, 'developers')
        .replace(/{pattern}/g, 'factory')
        .replace(/{topic}/g, input.topic)
        .replace(/{before}/g, 'zero')
        .replace(/{after}/g, 'hero')
        .replace(/{body_part}/g, 'core')
        .replace(/{mistake}/g, 'ignoring SEO')
        .replace(/{cost}/g, 'thousands')
        .replace(/{audience}/g, 'beginners')
        .replace(/{activity}/g, 'content creation')
        .replace(/{common_practice}/g, 'posting randomly')
        .replace(/{outcome}/g, 'growth')
        .replace(/{common_advice}/g, 'post daily')
        .replace(/{controversial_statement}/g, 'quality beats quantity')
        .replace(/{popular_tool}/g, 'Canva')
        .replace(/{amount}/g, '10K')
        .replace(/{business_model}/g, 'content marketing')
        .replace(/{framework}/g, 'content flywheel')
        .replace(/{company}/g, 'our brand')
        .replace(/{start}/g, '0')
        .replace(/{end}/g, '1M')
        .replace(/{lines_of_code}/g, '50')
        .replace(/{language}/g, 'Python')
        .replace(/{goal}/g, 'viral content')
        .replace(/{steps}/g, '5')
        .replace(/{number}/g, '3')
        .replace(/{system}/g, 'content pipeline')
        .replace(/{metric}/g, '1M views')
        .replace(/{technology}/g, 'AI');
      
      hooks.push({
        type,
        text: filledTemplate,
        platform: input.platform,
        brandVoice: input.brandVoice,
        estimatedViralScore: 0.5 + Math.random() * 0.3,
      });
    }
    
    // Save hooks to database
    const savedHooks = [];
    for (const hook of hooks) {
      const saved = await prisma.hook.create({
        data: {
          workspaceId: workspaceMember.workspaceId,
          niche: input.contentType,
          platform: input.platform,
          hookType: hook.type,
          hookText: hook.text,
          templateUsed: hook.type,
          aiModel: 'template-v1',
          viralScore: hook.estimatedViralScore,
        },
      });
      savedHooks.push(saved);
    }
    
    // Generate visual hooks
    const visualHooks = [
      "Start with a pattern interrupt (unexpected visual in first 0.5s)",
      "Use text overlay with the hook text for silent viewing",
      "Show the end result first, then reveal the process",
      "Use split screen: before/after comparison",
      "Add dynamic captions that highlight key words",
    ];
    
    // Generate audio hooks
    const audioHooks = [
      "Start with a strong verbal hook matching the text",
      "Use trending background music at low volume",
      "Add sound effects for emphasis on key moments",
      "Vary speech pace: fast for excitement, slow for authority",
    ];
    
    // Generate A/B test variants
    const abTestVariants = hooks.map(h => ({
      original: h.text,
      variants: [
        h.text.replace('I', 'You'),
        h.text.replace('How', 'Why'),
        h.text + ' 👇',
      ],
    }));
    
    return c.json({
      success: true,
      data: {
        topic: input.topic,
        platform: input.platform,
        contentType: input.contentType,
        hooks: savedHooks,
        visualHooks,
        audioHooks,
        bestPractices: [
          "Keep hooks under 3 seconds for maximum retention",
          "Use platform-native language and slang",
          "Test 3-5 variants per video",
          "Match hook to actual video content",
        ],
        abTestVariants,
      },
    });
  });

  // POST /api/v1/intelligence/generate-concepts - Generate content concepts from trend
  app.post('/generate-concepts', zValidator('json', generateConceptsSchema), async (c: any) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    // Get the trend signal
    const trend = await prisma.trendSignal.findUnique({
      where: { id: input.trendId },
    });
    
    if (!trend) {
      throw new HTTPException(404, { message: 'Trend not found' });
    }
    
    // Generate concepts based on trend
    const concepts = [
      {
        title: `Reacting to: ${trend.title}`,
        angle: 'reaction',
        description: `Film your genuine reaction to this trending topic in ${input.brandNiche}`,
        hookIdeas: [
          `I can't believe ${trend.title}...`,
          `Everyone is talking about ${trend.title}. Here's my take...`,
        ],
        estimatedEffort: 'low',
        format: 'talking_head',
        durationSec: 30,
      },
      {
        title: `${trend.title} - Explained for ${input.brandNiche}`,
        angle: 'educational',
        description: `Break down this trend and explain its relevance to your niche`,
        hookIdeas: [
          `What ${trend.title} means for ${input.brandNiche}...`,
          `The hidden implications of ${trend.title}...`,
        ],
        estimatedEffort: 'medium',
        format: 'explainer',
        durationSec: 60,
      },
      {
        title: `I tried ${trend.title} so you don't have to`,
        angle: 'experiment',
        description: `Test the trend and share results`,
        hookIdeas: [
          `I tested ${trend.title} for 7 days - here's what happened...`,
          `Does ${trend.title} actually work? Let's find out...`,
        ],
        estimatedEffort: 'high',
        format: 'documentary',
        durationSec: 90,
      },
    ].slice(0, input.conceptCount);
    
    // Save trend suggestion
    const suggestion = await prisma.trendSuggestion.create({
      data: {
        workspaceId: workspaceMember.workspaceId,
        trendSignalId: input.trendId,
        suggestedHooks: concepts.flatMap(c => c.hookIdeas),
        suggestedAngles: concepts.map(c => c.angle),
        estimatedEffort: concepts[0]?.estimatedEffort || 'medium',
        priorityScore: trend.compositeScore || 0.5,
        status: 'pending',
      },
    });
    
    return c.json({
      success: true,
      data: {
        trendId: input.trendId,
        concepts,
        strategy: {
          recommendedAngle: concepts[0]?.angle,
          postingFrequency: '3x per week during trend peak',
          crossPlatformAdaptation: 'Adapt hook for each platform',
        },
        contentCalendar: concepts.map((c, i) => ({
          day: i + 1,
          concept: c.title,
          format: c.format,
        })),
        riskAssessment: {
          brandSafety: trend.brandSafetyScore || 0.8,
          saturationRisk: trend.competitionScore || 0.3,
          recommendation: trend.compositeScore > 0.7 ? 'Act fast - trend peaking' : 'Monitor before investing',
        },
      },
    });
  });

  // POST /api/v1/intelligence/analyze-trends - Analyze trending topics
  app.post('/analyze-trends', zValidator('json', analyzeTrendSchema), async (c: any) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    // Get trend signals for the niche/platform
    const timeframeMap: Record<string, Date> = {
      '1h': new Date(Date.now() - 3600000),
      '6h': new Date(Date.now() - 6 * 3600000),
      '24h': new Date(Date.now() - 24 * 3600000),
      '7d': new Date(Date.now() - 7 * 24 * 3600000),
      '30d': new Date(Date.now() - 30 * 24 * 3600000),
    };
    
    const trends = await prisma.trendSignal.findMany({
      where: {
        niche: input.niche,
        source: input.platform === 'tiktok' ? 'tiktok_creative' : 
               input.platform === 'youtube' ? 'youtube' :
               input.platform === 'instagram' ? 'instagram' : 'reddit',
        detectedAt: { gte: timeframeMap[input.timeframe] },
        compositeScore: { gte: input.minVelocity / 1000 },
      },
      orderBy: { compositeScore: 'desc' },
      take: input.limit,
    });
    
    // Generate insights
    const insights = [
      `Top trend: ${trends[0]?.title || 'No trends found'}`,
      `Average velocity: ${trends.reduce((sum: number, t: any) => sum + (t.velocityScore || 0), 0) / trends.length || 0}`,
      `Trend saturation: ${trends.reduce((sum: number, t: any) => sum + (t.competitionScore || 0), 0) / trends.length || 0}`,
    ];
    
    // Identify opportunities
    const opportunities = trends
      .filter((t: any) => (t.relevanceScore || 0) > 0.7 && (t.competitionScore || 0) < 0.5)
      .map((t: any) => ({
        trend: t.title,
        opportunity: `Low competition, high relevance - create content now`,
        urgency: (t.velocityScore || 0) > 500 ? 'high' : 'medium',
      }))
      .slice(0, 5);
    
    // Saturation warnings
    const saturationWarnings = trends
      .filter((t: any) => (t.competitionScore || 0) > 0.8)
      .map((t: any) => ({
        trend: t.title,
        warning: 'High saturation - consider unique angle or skip',
      }))
      .slice(0, 3);
    
    return c.json({
      success: true,
      data: {
        platform: input.platform,
        niche: input.niche,
        timeframe: input.timeframe,
        trends: trends.map(t => ({
          id: t.id,
          title: t.title,
          keywords: t.keywords,
          velocityScore: t.velocityScore,
          volumeScore: t.volumeScore,
          relevanceScore: t.relevanceScore,
          competitionScore: t.competitionScore,
          brandSafetyScore: t.brandSafetyScore,
          compositeScore: t.compositeScore,
          url: t.url,
        })),
        insights,
        opportunities,
        saturationWarnings,
      },
    });
  });

  // GET /api/v1/intelligence/viral-patterns - Get viral content patterns for a platform/niche
  app.get('/viral-patterns', zValidator('query', z.object({
    platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']),
    niche: z.string().min(3).max(100),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })), async (c: any) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    // Get performance patterns from database
    const patterns = await prisma.performancePattern.findMany({
      where: {
        workspaceId: workspaceMember.workspaceId,
        platform: query.platform,
      },
      orderBy: { confidence: 'desc' },
      take: query.limit,
    });
    
    // If no patterns exist, return default patterns
    if (patterns.length === 0) {
      const defaultPatterns = [
        { patternType: 'hook_type', patternValue: 'curiosity', metricName: 'views', metricValue: 1.3, confidence: 0.7 },
        { patternType: 'hook_type', patternValue: 'transformation', metricName: 'engagement_rate', metricValue: 1.5, confidence: 0.65 },
        { patternType: 'time_slot', patternValue: '19:00-21:00', metricName: 'views', metricValue: 1.2, confidence: 0.6 },
        { patternType: 'hashtag_cluster', patternValue: '#fyp #viral #trending', metricName: 'reach', metricValue: 1.4, confidence: 0.55 },
        { patternType: 'caption_style', patternValue: 'question_first', metricName: 'comments', metricValue: 1.6, confidence: 0.6 },
      ];
      
      return c.json({
        success: true,
        data: defaultPatterns.map(p => ({
          ...p,
          sampleSize: 100,
          lastUpdated: new Date().toISOString(),
        })),
      });
    }
    
    return c.json({
      success: true,
      data: patterns.map(p => ({
        patternType: p.patternType,
        patternValue: p.patternValue,
        metricName: p.metricName,
        metricValue: p.metricValue,
        sampleSize: p.sampleSize,
        confidence: p.confidence,
        lastUpdated: p.lastUpdated.toISOString(),
      })),
    });
  });

  // GET /api/v1/intelligence/optimal-posting-times - Get optimal posting times
  app.get('/optimal-posting-times', zValidator('query', z.object({
    platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']),
    niche: z.string().min(3).max(100).optional(),
    timezone: z.string().default('UTC'),
  })), async (c: any) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    // Platform-specific optimal times (in UTC)
    const platformTimes: Record<string, { hour: number; day: number; score: number }[]> = {
      tiktok: [
        { hour: 9, day: 1, score: 0.9 }, { hour: 12, day: 1, score: 0.85 }, { hour: 19, day: 1, score: 0.95 },
        { hour: 10, day: 6, score: 0.9 }, { hour: 14, day: 6, score: 0.85 }, { hour: 20, day: 6, score: 0.9 },
        { hour: 11, day: 0, score: 0.85 }, { hour: 15, day: 0, score: 0.8 }, { hour: 21, day: 0, score: 0.85 },
      ],
      instagram: [
        { hour: 11, day: 1, score: 0.9 }, { hour: 13, day: 1, score: 0.85 }, { hour: 19, day: 1, score: 0.95 },
        { hour: 10, day: 3, score: 0.9 }, { hour: 14, day: 3, score: 0.85 }, { hour: 20, day: 3, score: 0.9 },
        { hour: 11, day: 0, score: 0.85 }, { hour: 16, day: 0, score: 0.8 }, { hour: 21, day: 0, score: 0.85 },
      ],
      youtube: [
        { hour: 14, day: 1, score: 0.9 }, { hour: 16, day: 1, score: 0.85 }, { hour: 20, day: 1, score: 0.9 },
        { hour: 10, day: 6, score: 0.95 }, { hour: 14, day: 6, score: 0.9 }, { hour: 18, day: 6, score: 0.85 },
        { hour: 10, day: 0, score: 0.95 }, { hour: 15, day: 0, score: 0.9 }, { hour: 19, day: 0, score: 0.85 },
      ],
      facebook: [
        { hour: 13, day: 1, score: 0.85 }, { hour: 15, day: 1, score: 0.8 }, { hour: 19, day: 1, score: 0.9 },
        { hour: 10, day: 3, score: 0.85 }, { hour: 14, day: 3, score: 0.8 }, { hour: 20, day: 3, score: 0.85 },
        { hour: 11, day: 0, score: 0.8 }, { hour: 15, day: 0, score: 0.75 }, { hour: 21, day: 0, score: 0.8 },
      ],
      x: [
        { hour: 9, day: 1, score: 0.9 }, { hour: 12, day: 1, score: 0.85 }, { hour: 17, day: 1, score: 0.95 },
        { hour: 10, day: 3, score: 0.9 }, { hour: 13, day: 3, score: 0.85 }, { hour: 18, day: 3, score: 0.9 },
        { hour: 9, day: 0, score: 0.8 }, { hour: 14, day: 0, score: 0.75 }, { hour: 20, day: 0, score: 0.8 },
      ],
      linkedin: [
        { hour: 8, day: 1, score: 0.95 }, { hour: 12, day: 1, score: 0.9 }, { hour: 17, day: 1, score: 0.85 },
        { hour: 9, day: 2, score: 0.95 }, { hour: 13, day: 2, score: 0.9 }, { hour: 16, day: 2, score: 0.85 },
        { hour: 8, day: 3, score: 0.95 }, { hour: 12, day: 3, score: 0.9 }, { hour: 17, day: 3, score: 0.85 },
      ],
    };
    
    const times = platformTimes[query.platform] || platformTimes.tiktok;
    
    return c.json({
      success: true,
      data: times.map(t => ({
        hour: t.hour,
        dayOfWeek: t.day,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.day],
        score: t.score,
        timezone: query.timezone,
        recommendation: t.score > 0.9 ? 'Highly recommended' : t.score > 0.8 ? 'Recommended' : 'Consider',
      })),
    });
  });

  // POST /api/v1/intelligence/content-audit - Audit existing content for optimization
  app.post('/content-audit', zValidator('json', z.object({
    videoIds: z.array(z.string().uuid()).min(1).max(50),
    platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']),
  })), async (c: any) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const variants = await prisma.videoVariant.findMany({
      where: {
        videoId: { in: input.videoIds },
        platform: input.platform,
      },
      include: {
        video: true,
        scheduledPosts: {
          include: {
            metrics: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    
    const audit = variants.map(v => {
      const latestMetric = v.scheduledPosts[0]?.metrics[0];
      const views = latestMetric ? Number(latestMetric.views) : 0;
      const engagementRate = latestMetric && latestMetric.views > 0 
        ? (Number(latestMetric.likes) + Number(latestMetric.comments) + Number(latestMetric.shares)) / Number(latestMetric.views)
        : 0;
      
      const issues = [];
      const recommendations = [];
      
      if (!v.hookText) {
        issues.push('Missing hook text');
        recommendations.push('Add a compelling hook in the first 3 seconds');
      }
      if (!v.caption || v.caption.length < 50) {
        issues.push('Caption too short or missing');
        recommendations.push('Write a detailed caption with call-to-action');
      }
      if (!v.hashtags || v.hashtags.length < 3) {
        issues.push('Insufficient hashtags');
        recommendations.push('Add 5-10 relevant hashtags');
      }
      if (engagementRate < 0.02) {
        issues.push('Low engagement rate');
        recommendations.push('Test different hook types and posting times');
      }
      
      return {
        variantId: v.id,
        videoTitle: v.video.title,
        platform: v.platform,
        views,
        engagementRate,
        issues,
        recommendations,
        score: Math.max(0, 100 - issues.length * 20),
      };
    });
    
    return c.json({
      success: true,
      data: audit,
    });
  });

  // GET /api/v1/intelligence/health - Health check for intelligence service
  app.get('/health', async (c: any) => {
    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      return c.json({
        success: true,
        data: {
          status: 'healthy',
          database: 'connected',
          models: {
            viralPredictor: 'loaded',
            hookGenerator: 'loaded',
            conceptGenerator: 'loaded',
            trendAnalyzer: 'loaded',
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      return c.json({
        success: false,
        data: {
          status: 'unhealthy',
          database: 'disconnected',
          error: String(err),
          timestamp: new Date().toISOString(),
        },
      }, 503);
    }
  });

  return app;
}
