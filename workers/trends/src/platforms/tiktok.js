import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../logger.js';

const TIKTOK_TRENDING_URL = 'https://www.tiktok.com/api/challenge/list';
const TIKTOK_SEARCH_URL = 'https://www.tiktok.com/api/search/general/full/';

async function detectTikTokTrends({ keywords = [], regions = ['US'], categories = [] }) {
  const trends = [];
  
  try {
    // Get trending hashtags from TikTok's discover page
    const trendingHashtags = await fetchTrendingHashtags(regions);
    
    for (const hashtag of trendingHashtags) {
      // Filter by keywords if provided
      if (keywords.length > 0 && !keywords.some(k => hashtag.title.toLowerCase().includes(k.toLowerCase()))) {
        continue;
      }
      
      // Get detailed stats for this hashtag
      const details = await fetchHashtagDetails(hashtag.challengeName);
      
      trends.push({
        platform: 'tiktok',
        topic: hashtag.title,
        hashtag: hashtag.challengeName,
        volume: details.stats?.videoCount || 0,
        velocity: calculateVelocity(details.stats?.videoCount, details.stats?.viewCount),
        sentiment: await analyzeSentiment(hashtag.challengeName),
        region: regions[0],
        category: categorizeHashtag(hashtag.title, categories),
        metadata: {
          viewCount: details.stats?.viewCount,
          isCommerce: details.isCommerce,
          coverUrl: details.coverUrl,
        },
      });
    }
    
    // Also search for keyword-specific trends
    if (keywords.length > 0) {
      for (const keyword of keywords.slice(0, 5)) {
        const searchTrends = await searchKeywordTrends(keyword, regions[0]);
        trends.push(...searchTrends);
      }
    }
    
    return trends;
  } catch (error) {
    logger.error({ err: error }, 'TikTok trend detection failed');
    return [];
  }
}

async function fetchTrendingHashtags(regions) {
  const hashtags = [];
  
  // Try multiple regions
  for (const region of regions.slice(0, 3)) {
    try {
      const response = await axios.get(TIKTOK_TRENDING_URL, {
        params: {
          region,
          count: 50,
          cursor: 0,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.tiktok.com/discover',
        },
        timeout: 10000,
      });
      
      if (response.data?.challengeList) {
        for (const challenge of response.data.challengeList) {
          hashtags.push({
            challengeName: challenge.challengeInfo?.challenge?.challengeName,
            title: challenge.challengeInfo?.challenge?.title,
            desc: challenge.challengeInfo?.challenge?.desc,
            stats: challenge.challengeInfo?.stats,
          });
        }
      }
    } catch (error) {
      logger.warn({ region, err: error }, 'Failed to fetch TikTok trending for region');
    }
  }
  
  return hashtags;
}

async function fetchHashtagDetails(challengeName) {
  try {
    const response = await axios.get(`https://www.tiktok.com/api/challenge/detail/`, {
      params: { challengeName, count: 10 },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
    });
    return response.data?.challengeInfo || {};
  } catch (error) {
    return {};
  }
}

async function searchKeywordTrends(keyword, region) {
  const trends = [];
  
  try {
    const response = await axios.get(TIKTOK_SEARCH_URL, {
      params: {
        keyword,
        region,
        count: 20,
        cursor: 0,
        search_type: 'hashtag',
      },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
    });
    
    if (response.data?.challenge_list) {
      for (const item of response.data.challenge_list) {
        trends.push({
          platform: 'tiktok',
          topic: item.challengeInfo?.challenge?.title || keyword,
          hashtag: item.challengeInfo?.challenge?.challengeName,
          volume: item.challengeInfo?.stats?.videoCount || 0,
          velocity: calculateVelocity(item.challengeInfo?.stats?.videoCount, item.challengeInfo?.stats?.viewCount),
          sentiment: 0.5,
          region,
          category: 'search',
          metadata: { source: 'search', keyword },
        });
      }
    }
  } catch (error) {
    logger.warn({ keyword, err: error }, 'TikTok keyword search failed');
  }
  
  return trends;
}

function calculateVelocity(videoCount, viewCount) {
  if (!videoCount || !viewCount) return 0;
  // Velocity = views per video (engagement indicator)
  return Math.min(viewCount / videoCount / 10000, 10); // Normalized 0-10
}

async function analyzeSentiment(hashtag) {
  // Simple sentiment based on hashtag keywords
  const positive = ['love', 'happy', 'fun', 'joy', 'best', 'amazing', 'awesome', 'win', 'success'];
  const negative = ['hate', 'sad', 'fail', 'worst', 'bad', 'terrible', 'angry', 'lose'];
  
  const lower = hashtag.toLowerCase();
  let score = 0.5;
  
  for (const word of positive) {
    if (lower.includes(word)) score += 0.1;
  }
  for (const word of negative) {
    if (lower.includes(word)) score -= 0.1;
  }
  
  return Math.max(0, Math.min(1, score));
}

function categorizeHashtag(title, categories) {
  const lower = title.toLowerCase();
  const categoryMap = {
    'entertainment': ['funny', 'comedy', 'meme', 'lol', 'humor', 'entertainment'],
    'dance': ['dance', 'choreo', 'dancing', 'move'],
    'music': ['music', 'song', 'sing', 'cover', 'remix'],
    'education': ['learn', 'tutorial', 'howto', 'education', 'tips', 'hack'],
    'lifestyle': ['life', 'lifestyle', 'daily', 'routine', 'vlog'],
    'fitness': ['fitness', 'workout', 'gym', 'exercise', 'health'],
    'beauty': ['beauty', 'makeup', 'skincare', 'fashion', 'style'],
    'food': ['food', 'recipe', 'cook', 'eat', 'restaurant'],
    'tech': ['tech', 'coding', 'programming', 'ai', 'software'],
    'business': ['business', 'entrepreneur', 'money', 'finance', 'startup'],
  };
  
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  
  // Check against provided categories
  for (const cat of categories) {
    if (lower.includes(cat.toLowerCase())) return cat;
  }
  
  return 'general';
}

export { detectTikTokTrends };