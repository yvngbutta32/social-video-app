import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { db } from '../../db.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CONCEPT_GENERATION_PROMPT = `You are an expert social media video strategist. Given a trending topic, generate 5 unique, high-potential video concepts tailored for short-form platforms (TikTok, Reels, Shorts).

Each concept must include:
1. Hook (first 3 seconds) - specific, visual, curiosity-inducing
2. Format - one of: tutorial, storytime, reaction, challenge, POV, listicle, before/after, myth-busting, day-in-life, comparison
3. Structure - beat-by-beat breakdown with timestamps
4. Visual cues - specific shots, text overlays, transitions
5. Audio strategy - trending sound, voiceover style, music mood
6. Caption strategy - hook, value, CTA
7. Hashtag strategy - 3 niche, 3 broad, 3 trending
8. Best posting time window
9. Predicted viral score (0-100) with reasoning
10. Difficulty level (easy/medium/hard) and estimated production time

Trend Data:
- Topic: {topic}
- Platform: {platform}
- Category: {category}
- Velocity: {velocity} (views/hour growth)
- Related hashtags: {hashtags}
- Top performing videos: {topVideos}

Target Audience: {audience}
Brand Voice: {brandVoice}
Content Pillars: {pillars}

Return as valid JSON array of 5 concepts.`;

async function generateConceptsForTrend(trend, userProfile) {
  const prompt = CONCEPT_GENERATION_PROMPT
    .replace('{topic}', trend.topic)
    .replace('{platform}', trend.platform)
    .replace('{category}', trend.category || 'general')
    .replace('{velocity}', trend.velocity || 'unknown')
    .replace('{hashtags}', trend.hashtags?.join(', ') || 'none')
    .replace('{topVideos}', trend.topVideos?.map(v => `${v.title} (${v.views}v)`).join('; ') || 'none')
    .replace('{audience}', userProfile.targetAudience || 'general')
    .replace('{brandVoice}', userProfile.brandVoice || 'authentic, energetic')
    .replace('{pillars}', userProfile.contentPillars?.join(', ') || 'education, entertainment');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert social media video strategist. Output only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const response = JSON.parse(completion.choices[0].message.content);
    return response.concepts || response;
  } catch (error) {
    logger.error({ err: error, trend: trend.id }, 'Failed to generate concepts');
    throw error;
  }
}

async function scoreConceptViability(concept, trend, userProfile) {
  // Heuristic scoring based on multiple factors
  let score = 50; // base

  // Trend velocity bonus
  if (trend.velocity > 100000) score += 15;
  else if (trend.velocity > 10000) score += 10;
  else if (trend.velocity > 1000) score += 5;

  // Format viability
  const highPerformingFormats = ['tutorial', 'storytime', 'reaction', 'listicle', 'before/after'];
  if (highPerformingFormats.includes(concept.format?.toLowerCase())) score += 10;

  // Hook strength (heuristic)
  const hook = concept.hook || '';
  if (hook.length > 50 && hook.length < 200) score += 5;
  if (/\?|!|secret|hidden|nobody|stop|wait/.test(hook.toLowerCase())) score += 5;

  // Production feasibility
  if (concept.difficulty === 'easy') score += 5;
  else if (concept.difficulty === 'hard') score -= 5;

  // Platform alignment
  const platformFormats = {
    tiktok: ['tutorial', 'storytime', 'challenge', 'POV', 'reaction'],
    instagram: ['tutorial', 'before/after', 'day-in-life', 'aesthetic', 'listicle'],
    youtube: ['tutorial', 'storytime', 'comparison', 'deep-dive', 'reaction'],
  };
  if (platformFormats[trend.platform]?.includes(concept.format?.toLowerCase())) score += 5;

  return Math.min(100, Math.max(0, score));
}

async function pushConceptsToQueue(concepts, trend, userId) {
  const amqp = await import('amqplib');
  const connection = await amqp.connect(config.rabbitmq.url);
  const channel = await connection.createChannel();
  
  await channel.assertQueue('concept.generation', { durable: true });
  
  for (const concept of concepts) {
    const message = {
      type: 'CONCEPT_GENERATED',
      userId,
      trendId: trend.id,
      concept: {
        ...concept,
        trendTopic: trend.topic,
        trendPlatform: trend.platform,
        generatedAt: new Date().toISOString(),
      },
    };
    
    channel.sendToQueue('concept.generation', Buffer.from(JSON.stringify(message)), {
      persistent: true,
      priority: 5,
    });
  }
  
  await channel.close();
  await connection.close();
}

export async function processTrendForConcepts(trend, userId) {
  logger.info({ trendId: trend.id, userId }, 'Processing trend for concept generation');
  
  try {
    // Get user profile
    const userProfile = await db.getUserProfile(userId);
    
    // Generate concepts
    const concepts = await generateConceptsForTrend(trend, userProfile);
    
    // Score each concept
    const scoredConcepts = await Promise.all(
      concepts.map(async (concept) => ({
        ...concept,
        viabilityScore: await scoreConceptViability(concept, trend, userProfile),
      }))
    );
    
    // Sort by viability score
    scoredConcepts.sort((a, b) => b.viabilityScore - a.viabilityScore);
    
    // Store in database
    for (const concept of scoredConcepts) {
      await db.saveConcept({
        userId,
        trendId: trend.id,
        ...concept,
      });
    }
    
    // Push top 3 to queue for further processing
    await pushConceptsToQueue(scoredConcepts.slice(0, 3), trend, userId);
    
    logger.info({ 
      trendId: trend.id, 
      conceptsGenerated: concepts.length,
      topScore: scoredConcepts[0]?.viabilityScore 
    }, 'Concept generation complete');
    
    return scoredConcepts;
  } catch (error) {
    logger.error({ err: error, trendId: trend.id }, 'Concept generation failed');
    throw error;
  }
}

export { generateConceptsForTrend, scoreConceptViability, pushConceptsToQueue };