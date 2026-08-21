import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../logger.js';

const INSTAGRAM_EXPLORE_URL = 'https://www.instagram.com/api/v1/discover/explore/';
const INSTAGRAM_HASHTAG_URL = 'https://www.instagram.com/api/v1/tags/web_info/';

async function detectInstagramTrends({ keywords = [], regions = ['US'], categories = [] }) {
  const trends = [];
  
  try {
    // Get trending from explore page
    const exploreData = await fetchExplorePage(regions[0]);
    
    // Extract hashtags from explore
    const hashtags = extractHashtagsFromExplore(exploreData);
    
    for (const hashtag of hashtags.slice(0, 30)) {
      if (keywords.length > 0 && !keywords.some(k => hashtag.toLowerCase().includes(k.toLowerCase()))) {
        continue;
      }
      
      const details = await fetchHashtagDetails(hashtag);
      
      trends.push({
        platform: 'instagram_reels',
        topic: details.name || hashtag,
        hashtag: hashtag,
        volume: details.mediaCount || 0,
        velocity: calculateVelocity(details.mediaCount),
        sentiment: 0.6, // Instagram tends to be more positive
        region: regions[0],
        category: categorizeHashtag(hashtag, categories),
        metadata: {
          relatedTags: details.relatedTags,
          isVerified: details.isVerified,
        },
      });
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
    logger.error({ err: error }, 'Instagram trend detection failed');
    return [];
  }
}

async function fetchExplorePage(region) {
  try {
    const response = await axios.get(INSTAGRAM_EXPLORE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        'X-IG-App-ID': '936619743392459',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      params: { __a: 1, __d: 'dis' },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    logger.warn({ err: error }, 'Failed to fetch Instagram explore');
    return {};
  }
}

function extractHashtagsFromExplore(data) {
  const hashtags = new Set();
  
  try {
    const sections = data?.explore?.sections || [];
    for (const section of sections) {
      const items = section?.layout_content?.medias || [];
      for (const item of items) {
        const media = item?.media;
        if (media?.caption?.text) {
          const tags = media.caption.text.match(/#[\w]+/g) || [];
          tags.forEach(tag => hashtags.add(tag.replace('#', '')));
        }
      }
    }
  } catch (error) {
    // Ignore parsing errors
  }
  
  return Array.from(hashtags);
}

async function fetchHashtagDetails(hashtag) {
  try {
    const response = await axios.get(`${INSTAGRAM_HASHTAG_URL}${hashtag}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        'X-IG-App-ID': '936619743392459',
      },
      params: { __a: 1 },
      timeout: 10000,
    });
    
    const data = response.data?.data?.hashtag || {};
    return {
      name: data.name,
      mediaCount: data.media_count,
      relatedTags: data.edge_hashtag_to_related_tags?.edges?.map(e => e.node.name) || [],
      isVerified: data.is_verified || false,
    };
  } catch (error) {
    return { name: hashtag, mediaCount: 0 };
  }
}

async function searchKeywordTrends(keyword) {
  const trends = [];
  
  try {
    const response = await axios.get(`https://www.instagram.com/web/search/topsearch/`, {
      params: {
        context: 'blended',
        query: keyword,
        rank_token: Math.random().toString(36).substring(2),
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        'X-IG-App-ID': '936619743392459',
      },
      timeout: 10000,
    });
    
    const hashtags = response.data?.hashtags || [];
    for (const item of hashtags.slice(0, 10)) {
      const tag = item.hashtag;
      trends.push({
        platform: 'instagram_reels',
        topic: tag.name,
        hashtag: tag.name,
        volume: tag.media_count || 0,
        velocity: calculateVelocity(tag.media_count),
        sentiment: 0.6,
        region: 'global',
        category: 'search',
        metadata: { source: 'search', keyword },
      });
    }
  } catch (error) {
    logger.warn({ keyword, err: error }, 'Instagram keyword search failed');
  }
  
  return trends;
}

function calculateVelocity(mediaCount) {
  if (!mediaCount) return 0;
  // Normalize: 1M posts = velocity 10
  return Math.min(mediaCount / 100000, 10);
}

function categorizeHashtag(hashtag, categories) {
  const lower = hashtag.toLowerCase();
  const categoryMap = {
    'reels': ['reels', 'reel', 'reelitfeelit', 'instareels'],
    'entertainment': ['funny', 'comedy', 'meme', 'humor', 'lol'],
    'dance': ['dance', 'dancing', 'choreography', 'dancer'],
    'music': ['music', 'song', 'singer', 'cover', 'musician'],
    'education': ['learn', 'tutorial', 'tips', 'hack', 'howto', 'educational'],
    'lifestyle': ['lifestyle', 'daily', 'vlog', 'life', 'routine'],
    'fitness': ['fitness', 'workout', 'gym', 'exercise', 'fit'],
    'beauty': ['beauty', 'makeup', 'skincare', 'fashion', 'style', 'ootd'],
    'food': ['food', 'recipe', 'cooking', 'foodie', 'eat'],
    'travel': ['travel', 'travelgram', 'wanderlust', 'vacation'],
    'tech': ['tech', 'coding', 'programming', 'ai', 'technology'],
    'business': ['business', 'entrepreneur', 'startup', 'money', 'finance'],
  };
  
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  
  for (const cat of categories) {
    if (lower.includes(cat.toLowerCase())) return cat;
  }
  
  return 'general';
}

export { detectInstagramTrends };