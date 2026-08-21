import { db } from './db.js';
import { logger } from './logger.js';
import { config } from './config.js';

export async function healthCheck() {
  const checks = {};
  let overallHealthy = true;
  
  // Database health
  try {
    const dbHealth = await db.healthCheck();
    checks.database = dbHealth;
    if (dbHealth.status !== 'healthy') overallHealthy = false;
  } catch (error) {
    checks.database = { status: 'unhealthy', error: error.message };
    overallHealthy = false;
  }
  
  // Platform detectors health (quick check)
  const platformChecks = {};
  const platforms = config.trends.enabledPlatforms || [];
  
  for (const platform of platforms) {
    try {
      // Simple config validation per platform
      const hasConfig = validatePlatformConfig(platform);
      platformChecks[platform] = hasConfig 
        ? { status: 'configured' } 
        : { status: 'misconfigured', error: 'Missing API credentials' };
      
      if (!hasConfig) overallHealthy = false;
    } catch (error) {
      platformChecks[platform] = { status: 'error', error: error.message };
      overallHealthy = false;
    }
  }
  checks.platforms = platformChecks;
  
  // Memory check
  const memUsage = process.memoryUsage();
  checks.memory = {
    status: memUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning', // 500MB
    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
    rssMB: Math.round(memUsage.rss / 1024 / 1024),
  };
  
  if (checks.memory.status === 'warning') overallHealthy = false;
  
  // Uptime
  checks.uptime = {
    status: 'healthy',
    seconds: Math.floor(process.uptime()),
  };
  
  return {
    status: overallHealthy ? 'healthy' : 'degraded',
    service: 'trends-worker',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    checks,
  };
}

function validatePlatformConfig(platform) {
  switch (platform) {
    case 'tiktok':
      return !!config.tiktok.apiKey;
    case 'instagram_reels':
      return !!config.instagram.appId;
    case 'youtube_shorts':
      return !!config.youtube.apiKey;
    case 'twitter':
      return !!config.twitter.bearerToken;
    case 'linkedin':
      return !!config.linkedin.sessionCookie;
    default:
      return false;
  }
}