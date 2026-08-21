export const config = {
  // Server
  port: process.env.PORT || 3003,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  database: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'social_video',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    pool: {
      min: 2,
      max: 10,
    },
  },
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  // Trends
  trends: {
    enabledPlatforms: (process.env.ENABLED_PLATFORMS || 'tiktok,instagram_reels,youtube_shorts,twitter,linkedin').split(','),
    keywords: (process.env.TREND_KEYWORDS || '').split(',').filter(Boolean),
    regions: (process.env.TREND_REGIONS || 'US,GB,CA,AU,DE,FR,JP').split(','),
    categories: (process.env.TREND_CATEGORIES || '').split(',').filter(Boolean),
    maxTrends: parseInt(process.env.MAX_TRENDS || '500'),
    detectionInterval: process.env.DETECTION_INTERVAL || '0 */2 * * *', // Every 2 hours
    
    // Platform-specific configurations
    tiktok: {
      keywords: (process.env.TIKTOK_TREND_KEYWORDS || '').split(',').filter(Boolean),
      regions: (process.env.TIKTOK_TREND_REGIONS || 'US,GB,CA,AU').split(','),
      categories: (process.env.TIKTOK_TREND_CATEGORIES || 'entertainment,dance,music,education,lifestyle,fitness,beauty,food,tech,business').split(','),
    },
    instagram: {
      keywords: (process.env.INSTAGRAM_TREND_KEYWORDS || '').split(',').filter(Boolean),
      regions: (process.env.INSTAGRAM_TREND_REGIONS || 'US,GB,CA,AU').split(','),
      categories: (process.env.INSTAGRAM_TREND_CATEGORIES || 'lifestyle,fashion,beauty,food,travel,fitness,art,photography').split(','),
    },
    youtube: {
      keywords: (process.env.YOUTUBE_TREND_KEYWORDS || '').split(',').filter(Boolean),
      regions: (process.env.YOUTUBE_TREND_REGIONS || 'US,GB,CA,AU').split(','),
      categories: (process.env.YOUTUBE_TREND_CATEGORIES || 'education,entertainment,tech,gaming,music,howto,vlog').split(','),
    },
    twitter: {
      keywords: (process.env.TWITTER_TREND_KEYWORDS || '').split(',').filter(Boolean),
      regions: (process.env.TWITTER_TREND_REGIONS || 'US,GB,CA,AU').split(','),
      categories: (process.env.TWITTER_TREND_CATEGORIES || 'news,tech,business,entertainment,sports,politics').split(','),
    },
    linkedin: {
      keywords: (process.env.LINKEDIN_TREND_KEYWORDS || '').split(',').filter(Boolean),
      regions: (process.env.LINKEDIN_TREND_REGIONS || 'US,GB,CA,AU').split(','),
      categories: (process.env.LINKEDIN_TREND_CATEGORIES || 'business,leadership,career,tech,marketing,entrepreneurship').split(','),
    },
  },
  
  // Platform API Keys
  tiktok: {
    apiKey: process.env.TIKTOK_API_KEY || '',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  
  instagram: {
    appId: process.env.INSTAGRAM_APP_ID || '936619743392459',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
  },
  
  twitter: {
    bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
  },
  
  linkedin: {
    sessionCookie: process.env.LINKEDIN_SESSION_COOKIE || '',
    csrfToken: process.env.LINKEDIN_CSRF_TOKEN || '',
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'json',
  
  // Health
  healthCheckInterval: 30000,
};