import { detectTikTokTrends } from './tiktok.js';
import { detectInstagramTrends } from './instagram.js';
import { detectYouTubeTrends } from './youtube.js';
import { detectTwitterTrends } from './twitter.js';
import { detectLinkedInTrends } from './linkedin.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { db } from '../db.js';

/**
 * Run trend detection across all platforms
 * @returns {Promise<Array>} Combined trends from all platforms
 */
export async function runTrendDetectionJob() {
  logger.info('Starting cross-platform trend detection job');
  
  const allTrends = [];
  
  // TikTok trends
  try {
    const tiktokTrends = await detectTikTokTrends({
      keywords: config.trends.tiktok.keywords,
      regions: config.trends.tiktok.regions,
      categories: config.trends.tiktok.categories,
    });
    allTrends.push(...tiktokTrends);
    logger.info({ count: tiktokTrends.length }, 'TikTok trends detected');
  } catch (error) {
    logger.error({ err: error }, 'TikTok trend detection failed');
  }
  
  // Instagram trends
  try {
    const instagramTrends = await detectInstagramTrends({
      keywords: config.trends.instagram.keywords,
      regions: config.trends.instagram.regions,
      categories: config.trends.instagram.categories,
    });
    allTrends.push(...instagramTrends);
    logger.info({ count: instagramTrends.length }, 'Instagram trends detected');
  } catch (error) {
    logger.error({ err: error }, 'Instagram trend detection failed');
  }
  
  // YouTube trends
  try {
    const youtubeTrends = await detectYouTubeTrends({
      keywords: config.trends.youtube.keywords,
      regions: config.trends.youtube.regions,
      categories: config.trends.youtube.categories,
    });
    allTrends.push(...youtubeTrends);
    logger.info({ count: youtubeTrends.length }, 'YouTube trends detected');
  } catch (error) {
    logger.error({ err: error }, 'YouTube trend detection failed');
  }
  
  // Twitter/X trends
  try {
    const twitterTrends = await detectTwitterTrends({
      keywords: config.trends.twitter.keywords,
      regions: config.trends.twitter.regions,
      categories: config.trends.twitter.categories,
    });
    allTrends.push(...twitterTrends);
    logger.info({ count: twitterTrends.length }, 'Twitter trends detected');
  } catch (error) {
    logger.error({ err: error }, 'Twitter trend detection failed');
  }
  
  // LinkedIn trends
  try {
    const linkedinTrends = await detectLinkedInTrends({
      keywords: config.trends.linkedin.keywords,
      regions: config.trends.linkedin.regions,
      categories: config.trends.linkedin.categories,
    });
    allTrends.push(...linkedinTrends);
    logger.info({ count: linkedinTrends.length }, 'LinkedIn trends detected');
  } catch (error) {
    logger.error({ err: error }, 'LinkedIn trend detection failed');
  }
  
  // Deduplicate by topic + platform
  const seen = new Set();
  const uniqueTrends = allTrends.filter(trend => {
    const key = `${trend.platform}:${trend.topic}:${trend.hashtag}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Sort by velocity (trending strength)
  uniqueTrends.sort((a, b) => (b.velocity || 0) - (a.velocity || 0));
  
  // Store top trends in database
  for (const trend of uniqueTrends.slice(0, 100)) {
    try {
      await db.query(`
        INSERT INTO trends (topic, platform, hashtag, volume, velocity, sentiment, region, category, metadata, detected_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (platform, hashtag, detected_at::date) DO UPDATE SET
          volume = EXCLUDED.volume,
          velocity = EXCLUDED.velocity,
          sentiment = EXCLUDED.sentiment,
          metadata = EXCLUDED.metadata
      `, [
        trend.topic,
        trend.platform,
        trend.hashtag,
        trend.volume,
        trend.velocity,
        trend.sentiment,
        trend.region,
        trend.category,
        JSON.stringify(trend.metadata),
      ]);
    } catch (error) {
      logger.warn({ err: error, trend: trend.topic }, 'Failed to store trend');
    }
  }
  
  logger.info({ total: uniqueTrends.length, stored: Math.min(uniqueTrends.length, 100) }, 'Trend detection job complete');
  return uniqueTrends;
}

/**
 * Health check endpoint
 */
export async function healthCheck() {
  try {
    await db.query('SELECT 1');
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
}

// Re-export individual platform detectors
export {
  detectTikTokTrends,
  detectInstagramTrends,
  detectYouTubeTrends,
  detectTwitterTrends,
  detectLinkedInTrends,
};