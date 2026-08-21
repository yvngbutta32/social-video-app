const config = require('../config');
const logger = require('../logger');
const db = require('../db');
const { OpenAI } = require('openai');
const axios = require('axios');

class ConceptGenerator {
  constructor() {
    this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    this.platforms = config.concepts.platforms;
    this.trendsWorkerUrl = config.trendsWorker.url;
  }

  // Platform-specific concept strategies
  getPlatformStrategy(platform) {
    const strategies = {
      tiktok: {
        format: 'Fast cuts, trending audio, POV/style, 15-60s',
        structure: ['Hook (0-3s)', 'Setup (3-8s)', 'Meat (8-20s)', 'Twist/Climax (20-40s)', 'CTA (40s+)'],
        visualStyle: 'Raw, authentic, jump cuts, text overlays, green screen',
        audioStrategy: 'Trending sounds, voiceover, ASMR, original audio',
        difficulty: 'beginner',
        maxDuration: 60,
      },
      instagram: {
        format: 'Polished Reels, aesthetic transitions, carousel-friendly',
        structure: ['Visual Hook', 'Value Delivery', 'Personality Moment', 'Save/Share CTA'],
        visualStyle: 'High quality, color graded, smooth transitions, brand consistent',
        audioStrategy: 'Trending Reels audio, voiceover, music beds',
        difficulty: 'beginner',
        maxDuration: 90,
      },
      youtube: {
        format: 'Shorts: punchy, loopable. Long-form: deep dive, chapters',
        structure: ['Title Hook', 'Promise', 'Evidence/Story', 'Key Takeaway', 'Next Video CTA'],
        visualStyle: 'Thumbnail-ready moments, B-roll, graphics, face-to-camera',
        audioStrategy: 'Clear narration, background music, sound design',
        difficulty: 'intermediate',
        maxDuration: 60, // For Shorts
      },
      twitter: {
        format: 'Video tweets, threads with video, native upload',
        structure: ['Text Hook', 'Video Proof', 'Thread Context', 'Discussion Starter'],
        visualStyle: 'Raw, documentary, screen record, talking head',
        audioStrategy: 'Clear speech, captions mandatory, minimal music',
        difficulty: 'beginner',
        maxDuration: 140,
      },
      linkedin: {
        format: 'Professional insights, thought leadership, case studies',
        structure: ['Professional Hook', 'Context/Problem', 'Solution/Insight', 'Discussion Question'],
        visualStyle: 'Clean, branded, subtitles, lower thirds, professional lighting',
        audioStrategy: 'Clear narration, no background music, professional tone',
        difficulty: 'intermediate',
        maxDuration: 600,
      },
    };
    return strategies[platform] || strategies.tiktok;
  }

  // Main entry: Generate concepts from a trend
  async generateConceptsFromTrend(trendData, userData, platforms = null) {
    const targetPlatforms = platforms || this.platforms;
    const allConcepts = [];

    for (const platform of targetPlatforms) {
      if (trendData.platformScores && trendData.platformScores[platform] < config.concepts.minTrendScore) {
        logger.debug('Trend score too low for platform', { trendId: trendData.id, platform, score: trendData.platformScores[platform] });
        continue;
      }

      try {
        const concepts = await this.generateConceptsForPlatform(trendData, userData, platform);
        allConcepts.push(...concepts);
      } catch (err) {
        logger.error('Failed to generate concepts for platform', { platform, error: err.message });
      }
    }

    return allConcepts;
  }

  async generateConceptsForPlatform(trendData, userData, platform) {
    const strategy = this.getPlatformStrategy(platform);
    const maxConcepts = config.concepts.maxConceptsPerTrend;
    const concepts = [];

    // Get relevant concept templates
    const templates = await db.getConceptTemplates(platform, trendData.category, strategy.difficulty, 5);

    // Determine concept angles based on trend type
    const angles = this.determineAngles(trendData, platform);

    for (const angle of angles.slice(0, maxConcepts)) {
      try {
        const concept = await this.generateSingleConcept(trendData, userData, platform, angle, strategy, templates);
        if (concept) {
          concepts.push(concept);
        }
      } catch (err) {
        logger.warn('Failed to generate concept', { angle, platform, error: err.message });
      }
    }

    // Score and save concepts
    const scoredConcepts = await this.scoreConcepts(concepts, trendData, userData, platform);
    const savedConcepts = [];

    for (const concept of scoredConcepts) {
      const saved = await db.createTrendConcept({
        trend_id: trendData.id,
        user_id: userData.id,
        platform,
        concept_title: concept.title,
        concept_description: concept.description,
        script_outline: concept.scriptOutline,
        visual_cues: concept.visualCues,
        audio_cues: concept.audioCues,
        hashtags: concept.hashtags,
        estimated_duration: concept.estimatedDuration,
        difficulty: concept.difficulty,
        viral_potential: concept.viralPotential,
        status: 'draft',
        metadata: {
          trendData: {
            id: trendData.id,
            topic: trendData.topic,
            source: trendData.source,
          },
          angle: concept.angle,
          templateUsed: concept.templateUsed,
          strategy: strategy.format,
          generationModel: config.openai.model,
        },
      });
      savedConcepts.push(saved);
    }

    return savedConcepts;
  }

  determineAngles(trendData, platform) {
    const baseAngles = [
      'educational_tutorial',
      'personal_experience',
      'contrarian_take',
      'behind_scenes',
      'step_by_step',
      'mistake_avoidance',
      'quick_tips',
      'transformation',
      'comparison',
      'prediction',
    ];

    // Platform-specific angle priorities
    const platformPriorities = {
      tiktok: ['transformation', 'mistake_avoidance', 'quick_tips', 'personal_experience', 'behind_scenes'],
      instagram: ['personal_experience', 'transformation', 'behind_scenes', 'educational_tutorial', 'step_by_step'],
      youtube: ['educational_tutorial', 'step_by_step', 'comparison', 'personal_experience', 'prediction'],
      twitter: ['contrarian_take', 'prediction', 'quick_tips', 'mistake_avoidance', 'comparison'],
      linkedin: ['educational_tutorial', 'personal_experience', 'case_study', 'prediction', 'step_by_step'],
    };

    const priorities = platformPriorities[platform] || baseAngles;
    const remaining = baseAngles.filter(a => !priorities.includes(a));
    return [...priorities, ...remaining];
  }

  async generateSingleConcept(trendData, userData, platform, angle, strategy, templates) {
    const prompt = this.buildConceptPrompt(trendData, userData, platform, angle, strategy, templates);

    try {
      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert ${platform} content strategist. Create detailed, actionable video concepts that beginners can execute. Focus on ${strategy.format}.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        maxTokens: 2000,
        responseFormat: { type: 'json_object' },
      });

      const concept = JSON.parse(completion.choices[0].message.content);
      return {
        ...concept,
        angle,
        platform,
        templateUsed: concept.templateUsed || null,
      };
    } catch (err) {
      logger.error('Concept generation failed', { error: err.message, angle, platform });
      return null;
    }
  }

  buildConceptPrompt(trendData, userData, platform, angle, strategy, templates) {
    const niche = userData.niche || 'general';
    const skillLevel = userData.skillLevel || 'beginner';
    const resources = userData.resources || ['smartphone'];

    const angleGuides = {
      educational_tutorial: 'Teach a specific skill related to the trend. Break into 3-5 clear steps.',
      personal_experience: 'Share your authentic story/journey with the trend. Be vulnerable and relatable.',
      contrarian_take: 'Challenge the mainstream narrative about this trend. Back with evidence.',
      behind_scenes: 'Show the "how it\'s made" or reality behind the trend. Raw and unfiltered.',
      step_by_step: 'Walk through a process from start to finish. Each step visual and clear.',
      mistake_avoidance: 'Reveal common mistakes and how to fix them. Save viewers time/money.',
      quick_tips: '3-5 rapid-fire tips. High density, high value, easy to consume.',
      transformation: 'Show a before/after. Document the journey. Inspire action.',
      comparison: 'Compare 2-3 approaches/tools/outcomes. Help viewers decide.',
      prediction: 'Forecast where this trend is going. Position as thought leader.',
      case_study: 'Deep dive into a specific example with data/results. Proof-based.',
    };

    const templateInfo = templates.length > 0
      ? `\nAvailable Templates:\n${templates.map(t => `- ${t.name}: ${JSON.stringify(t.structure)}`).join('\n')}`
      : '';

    return `
TREND DATA:
- Topic: ${trendData.topic}
- Description: ${trendData.description}
- Category: ${trendData.category}
- Platform: ${platform}
- Trend Score: ${trendData.platformScores?.[platform] || 'N/A'}
- Key Hashtags: ${(trendData.hashtags || []).slice(0, 10).join(', ')}
- Related Keywords: ${(trendData.keywords || []).slice(0, 10).join(', ')}

USER PROFILE:
- Niche: ${niche}
- Skill Level: ${skillLevel}
- Resources: ${resources.join(', ')}
- Follower Count: ${userData.followerCount || 'unknown'}
- Brand Voice: ${userData.brandVoice || 'authentic and helpful'}

PLATFORM STRATEGY:
- Format: ${strategy.format}
- Structure: ${strategy.structure.join(' → ')}
- Visual Style: ${strategy.visualStyle}
- Audio Strategy: ${strategy.audioStrategy}
- Max Duration: ${strategy.maxDuration}s
- Difficulty: ${strategy.difficulty}

CONCEPT ANGLE: ${angle}
GUIDE: ${angleGuides[angle]}

${templateInfo}

Generate a complete video concept as JSON with this structure:
{
  "title": "Compelling, click-worthy title (platform-native)",
  "description": "2-3 sentence hook for the concept",
  "scriptOutline": [
    {"section": "Hook", "timeRange": "0-3s", "action": "What happens visually", "dialogue": "What is said/shown", "visualNotes": "Camera angles, text overlays, etc."},
    {"section": "Setup", "timeRange": "3-8s", "action": "...", "dialogue": "...", "visualNotes": "..."}
  ],
  "visualCues": ["Specific shot: description", "Transition: type", "Text overlay: content", "Effect: type"],
  "audioCues": ["Music: trending sound name or style", "Voiceover: tone/pacing", "SFX: specific sounds", "Pacing: fast/medium/slow"],
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "estimatedDuration": 45,
  "difficulty": "beginner",
  "viralPotential": 0.75,
  "templateUsed": "template_name_or_null",
  "requiredResources": ["smartphone", "ring light", "editing app"],
  "beginnerTips": ["Tip 1 for first-time creators", "Tip 2", "Tip 3"]
}

Make it EXECUTABLE for a beginner. Every step must be visual and specific.
`.trim();
  }

  async scoreConcepts(concepts, trendData, userData, platform) {
    // Base scoring on multiple factors
    return concepts.map(concept => {
      let score = concept.viralPotential || 0.5;

      // Trend alignment bonus
      const trendScore = trendData.platformScores?.[platform] || 0.5;
      score = (score + trendScore) / 2;

      // Difficulty match bonus
      const strategy = this.getPlatformStrategy(platform);
      if (concept.difficulty === strategy.difficulty) {
        score += 0.05;
      }

      // Resource availability
      const userResources = new Set((userData.resources || []).map(r => r.toLowerCase()));
      const requiredResources = (concept.requiredResources || []).map(r => r.toLowerCase());
      const hasResources = requiredResources.every(r => userResources.has(r));
      if (hasResources) {
        score += 0.05;
      }

      // Completeness bonus
      if (concept.scriptOutline && concept.scriptOutline.length >= 4) score += 0.05;
      if (concept.visualCues && concept.visualCues.length >= 3) score += 0.03;
      if (concept.audioCues && concept.audioCues.length >= 2) score += 0.02;
      if (concept.beginnerTips && concept.beginnerTips.length >= 2) score += 0.05;

      return {
        ...concept,
        viralPotential: Math.min(Math.max(parseFloat(score.toFixed(3)), 0), 1),
      };
    }).sort((a, b) => b.viralPotential - a.viralPotential);
  }

  // Fetch trending topics from trends worker
  async fetchTrendingTopics(platform, category = null, limit = 20) {
    try {
      const params = new URLSearchParams({ platform, limit: limit.toString() });
      if (category) params.append('category', category);

      const response = await axios.get(`${this.trendsWorkerUrl}/api/trends?${params}`, {
        timeout: 10000,
      });

      return response.data.trends || [];
    } catch (err) {
      logger.error('Failed to fetch trends', { error: err.message, platform });
      return [];
    }
  }

  // Generate concepts for user's niche across platforms
  async generatePersonalizedConcepts(userData, platforms = null, limit = 10) {
    const targetPlatforms = platforms || this.platforms;
    const allConcepts = [];

    for (const platform of targetPlatforms) {
      try {
        // Get trends for user's niche
        const trends = await this.fetchTrendingTopics(platform, userData.niche, 10);

        for (const trend of trends.slice(0, 3)) { // Top 3 trends per platform
          const concepts = await this.generateConceptsForPlatform(trend, userData, platform);
          allConcepts.push(...concepts);
        }
      } catch (err) {
        logger.error('Personalized concept generation failed', { platform, error: err.message });
      }
    }

    // Sort by viral potential and return top
    return allConcepts
      .sort((a, b) => (b.metadata?.viralPotential || 0) - (a.metadata?.viralPotential || 0))
      .slice(0, limit);
  }

  // Optimize existing concept for better performance
  async optimizeConcept(conceptId, feedbackData) {
    const concept = await db.query(
      'SELECT * FROM trend_concepts WHERE id = $1',
      [conceptId]
    );

    if (!concept.rows[0]) {
      throw new Error('Concept not found');
    }

    const current = concept.rows[0];
    const strategy = this.getPlatformStrategy(current.platform);

    const prompt = `
ORIGINAL CONCEPT:
Title: ${current.concept_title}
Description: ${current.concept_description}
Script: ${JSON.stringify(current.script_outline)}
Viral Potential: ${current.viral_potential}

FEEDBACK:
${JSON.stringify(feedbackData, null, 2)}

PLATFORM: ${current.platform} (${strategy.format})

Improve this concept to increase viral potential. Focus on:
1. Stronger hook in first 3 seconds
2. Better pacing and retention hooks
3. More platform-native elements
4. Clearer beginner instructions
5. Higher emotional engagement

Return improved concept as JSON with same structure.
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        maxTokens: 2000,
        responseFormat: { type: 'json_object' },
      });

      const optimized = JSON.parse(completion.choices[0].message.content);

      // Update in database
      await db.query(
        `UPDATE trend_concepts SET
          concept_title = $1,
          concept_description = $2,
          script_outline = $3,
          visual_cues = $4,
          audio_cues = $5,
          hashtags = $6,
          estimated_duration = $7,
          viral_potential = $8,
          metadata = metadata || jsonb_build_object('optimized', true, 'optimizedAt', NOW(), 'feedback', $9)
        WHERE id = $10`,
        [
          optimized.title,
          optimized.description,
          JSON.stringify(optimized.scriptOutline),
          JSON.stringify(optimized.visualCues),
          JSON.stringify(optimized.audioCues),
          optimized.hashtags,
          optimized.estimatedDuration,
          optimized.viralPotential,
          JSON.stringify(feedbackData),
          conceptId,
        ]
      );

      return optimized;
    } catch (err) {
      logger.error('Concept optimization failed', { error: err.message, conceptId });
      throw err;
    }
  }
}

module.exports = new ConceptGenerator();