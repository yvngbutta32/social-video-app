import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../logger.js';

const TWITTER_TRENDS_URL = 'https://api.twitter.com/2/tweets/search/recent';
const TWITTER_API_BASE = 'https://api.twitter.com/2';

async function detectTwitterTrends({ keywords = [], regions = ['US'], categories = [] }) {
  const trends = [];
  
  try {
    if (!config.twitter.bearerToken) {
      logger.warn('Twitter bearer token not configured, skipping Twitter trend detection');
      return trends;
    }
    
    // Get trending topics for each region
    for (const region of regions.slice(0, 3)) {
      const regionTrends = await fetchTrendingTopics(region);
      
      for (const trend of regionTrends.slice(0, 20)) {
        if (keywords.length > 0 && !keywords.some(k => trend.name.toLowerCase().includes(k.toLowerCase()))) {
          continue;
        }
        
        // Get tweet volume for this trend
        const volume = await getTweetVolume(trend.name);
        
        trends.push({
          platform: 'twitter',
          topic: trend.name,
          hashtag: trend.name.startsWith('#') ? trend.name.slice(1) : trend.name,
          volume: volume,
          velocity: calculateVelocity(volume, trend.tweetVolume),
          sentiment: await analyzeSentiment(trend.name),
          region,
          category: categorizeTopic(trend.name, categories),
          metadata: {
            trendType: 'trending',
            query: trend.query,
          },
        });
      }
    }
    
    // Search for keyword-specific trends
    if (keywords.length > 0) {
      for (const keyword of keywords.slice(0, 5)) {
        const searchTrends = await searchKeywordTrends(keyword);
        trends.push(...searchTrends);
      }
    }
    
    return trends;
  } catch (error) {
    logger.error({ err: error }, 'Twitter trend detection failed');
    return [];
  }
}

async function fetchTrendingTopics(region) {
  // Twitter API v2 doesn't have a direct trends endpoint
  // We'll use recent search with trending queries
  const trendingQueries = [
    '#fyp', '#viral', '#trending', '#foryou', '#explore',
    '#news', '#tech', '#ai', '#crypto', '#stocks',
    '#fitness', '#health', '#food', '#travel', '#fashion',
  ];
  
  const trends = [];
  
  for (const query of trendingQueries.slice(0, 10)) {
    try {
      const response = await axios.get(TWITTER_TRENDS_URL, {
        params: {
          query: `${query} -is:retweet lang:en`,
          max_results: 10,
          'tweet.fields': 'public_metrics,created_at',
        },
        headers: {
          'Authorization': `Bearer ${config.twitter.bearerToken}`,
        },
        timeout: 10000,
      });
      
      const tweets = response.data?.data || [];
      if (tweets.length > 0) {
        trends.push({
          name: query,
          query: query,
          tweetVolume: tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0), 0),
        });
      }
    } catch (error) {
      logger.warn({ query, err: error }, 'Twitter trending query failed');
    }
  }
  
  return trends;
}

async function getTweetVolume(hashtag) {
  try {
    const response = await axios.get(TWITTER_TRENDS_URL, {
      params: {
        query: `#${hashtag.replace('#', '')} -is:retweet lang:en`,
        max_results: 100,
        'tweet.fields': 'public_metrics',
      },
      headers: { 'Authorization': `Bearer ${config.twitter.bearerToken}` },
      timeout: 10000,
    });
    
    const tweets = response.data?.data || [];
    return tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0) + (t.public_metrics?.like_count || 0), 0);
  } catch (error) {
    return 0;
  }
}

async function searchKeywordTrends(keyword) {
  const trends = [];
  
  try {
    const response = await axios.get(TWITTER_TRENDS_URL, {
      params: {
        query: `${keyword} -is:retweet lang:en`,
        max_results: 50,
        'tweet.fields': 'public_metrics,entities',
      },
      headers: { 'Authorization': `Bearer ${config.twitter.bearerToken}` },
      timeout: 10000,
    });
    
    const tweets = response.data?.data || [];
    const hashtags = new Map();
    
    for (const tweet of tweets) {
      const entities = tweet.entities?.hashtags || [];
      for (const tag of entities) {
        const count = hashtags.get(tag.tag) || 0;
        hashtags.set(tag.tag, count + (tweet.public_metrics?.retweet_count || 0) + (tweet.public_metrics?.like_count || 0));
      }
    }
    
    for (const [hashtag, volume] of hashtags.entries()) {
      trends.push({
        platform: 'twitter',
        topic: `#${hashtag}`,
        hashtag: hashtag,
        volume,
        velocity: calculateVelocity(volume),
        sentiment: 0.5,
        region: 'global',
        category: 'search',
        metadata: { source: 'search', keyword },
      });
    }
  } catch (error) {
    logger.warn({ keyword, err: error }, 'Twitter keyword search failed');
  }
  
  return trends;
}

function calculateVelocity(volume, tweetVolume) {
  const total = volume || tweetVolume || 0;
  if (!total) return 0;
  // Normalize: 100k interactions = velocity 10
  return Math.min(total / 10000, 10);
}

async function analyzeSentiment(text) {
  const positive = ['love', 'great', 'amazing', 'best', 'awesome', 'happy', 'win', 'success', 'bullish'];
  const negative = ['hate', 'bad', 'worst', 'terrible', 'sad', 'fail', 'lose', 'bearish', 'crash'];
  
  const lower = text.toLowerCase();
  let score = 0.5;
  
  for (const word of positive) {
    if (lower.includes(word)) score += 0.05;
  }
  for (const word of negative) {
    if (lower.includes(word)) score -= 0.05;
  }
  
  return Math.max(0, Math.min(1, score));
}

function categorizeTopic(topic, categories) {
  const lower = topic.toLowerCase();
  const categoryMap = {
    'news': ['news', 'breaking', 'update', 'report'],
    'tech': ['tech', 'ai', 'software', 'app', 'digital', 'crypto', 'blockchain'],
    'finance': ['stock', 'crypto', 'bitcoin', 'eth', 'trading', 'invest', 'market'],
    'sports': ['sport', 'football', 'basketball', 'soccer', 'nfl', 'nba', 'fifa'],
    'entertainment': ['movie', 'film', 'celebrity', 'star', 'music', 'concert'],
    'gaming': ['game', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam'],
    'politics': ['politics', 'election', 'vote', 'government', 'policy'],
    'health': ['health', 'fitness', 'workout', 'mental', 'wellness'],
    'food': ['food', 'recipe', 'restaurant', 'cook', 'eat'],
    'travel': ['travel', 'vacation', 'flight', 'hotel', 'trip'],
  };
  
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  
  for (const cat of categories) {
    if (lower.includes(cat.toLowerCase())) return cat;
  }
  
  return 'general';
}

export { detectTwitterTrends };