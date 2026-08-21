import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../logger.js';

const LINKEDIN_TRENDING_URL = 'https://www.linkedin.com/voyager/api/graphql';
const LINKEDIN_HASHTAG_URL = 'https://www.linkedin.com/voyager/api/feed/hashtag';

async function detectLinkedInTrends({ keywords = [], regions = ['US'], categories = [] }) {
  const trends = [];
  
  try {
    if (!config.linkedin.sessionCookie) {
      logger.warn('LinkedIn session cookie not configured, skipping LinkedIn trend detection');
      return trends;
    }
    
    // Get trending hashtags from LinkedIn
    const trendingHashtags = await fetchTrendingHashtags();
    
    for (const hashtag of trendingHashtags.slice(0, 25)) {
      if (keywords.length > 0 && !keywords.some(k => hashtag.name.toLowerCase().includes(k.toLowerCase()))) {
        continue;
      }
      
      const details = await fetchHashtagDetails(hashtag.name);
      
      trends.push({
        platform: 'linkedin',
        topic: hashtag.name,
        hashtag: hashtag.name.replace('#', ''),
        volume: details.followerCount || 0,
        velocity: calculateVelocity(details.followerCount, details.postCount),
        sentiment: 0.7, // LinkedIn is generally positive/professional
        region: 'global',
        category: categorizeHashtag(hashtag.name, categories),
        metadata: {
          followerCount: details.followerCount,
          postCount: details.postCount,
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
    logger.error({ err: error }, 'LinkedIn trend detection failed');
    return [];
  }
}

async function fetchTrendingHashtags() {
  const hashtags = [];
  
  // LinkedIn trending hashtags (curated professional topics)
  const professionalTopics = [
    '#leadership', '#innovation', '#technology', '#ai', '#machinelearning',
    '#digitaltransformation', '#entrepreneurship', '#startup', '#business',
    '#marketing', '#sales', '#productivity', '#career', '#jobsearch',
    '#hiring', '#recruiting', '#remotework', '#futureofwork', '#skills',
    '#upskilling', '#personaldevelopment', '#networking', '#mentorship',
    '#diversity', '#inclusion', '#sustainability', '#esg', '#fintech',
    '#healthtech', '#edtech', '#proptech', '#climatetech', '#web3',
  ];
  
  for (const topic of professionalTopics) {
    try {
      const details = await fetchHashtagDetails(topic.replace('#', ''));
      if (details.followerCount > 1000) {
        hashtags.push({
          name: topic,
          ...details,
        });
      }
    } catch (error) {
      logger.warn({ topic, err: error }, 'Failed to fetch LinkedIn hashtag details');
    }
  }
  
  // Sort by follower count
  return hashtags.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
}

async function fetchHashtagDetails(hashtag) {
  try {
    const response = await axios.get(`${LINKEDIN_HASHTAG_URL}/${hashtag}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': config.linkedin.sessionCookie,
        'Csrf-Token': config.linkedin.csrfToken || '',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      timeout: 10000,
    });
    
    const data = response.data?.data || {};
    return {
      name: `#${hashtag}`,
      followerCount: data.followerCount || 0,
      postCount: data.postCount || 0,
      isVerified: data.isVerified || false,
    };
  } catch (error) {
    return { name: `#${hashtag}`, followerCount: 0, postCount: 0 };
  }
}

async function searchKeywordTrends(keyword) {
  const trends = [];
  
  try {
    // Search for hashtags related to keyword
    const searchTerms = [
      `#${keyword}`,
      `#${keyword}news`,
      `#${keyword}trends`,
      `#${keyword}insights`,
    ];
    
    for (const term of searchTerms) {
      const details = await fetchHashtagDetails(term.replace('#', ''));
      if (details.followerCount > 500) {
        trends.push({
          platform: 'linkedin',
          topic: term,
          hashtag: term.replace('#', ''),
          volume: details.followerCount,
          velocity: calculateVelocity(details.followerCount),
          sentiment: 0.7,
          region: 'global',
          category: 'search',
          metadata: { source: 'search', keyword },
        });
      }
    }
  } catch (error) {
    logger.warn({ keyword, err: error }, 'LinkedIn keyword search failed');
  }
  
  return trends;
}

function calculateVelocity(followerCount, postCount) {
  if (!followerCount) return 0;
  const posts = postCount || followerCount * 0.1; // Estimate if not available
  // Velocity = posts per 1000 followers (activity indicator)
  return Math.min((posts / followerCount) * 1000, 10);
}

function categorizeHashtag(hashtag, categories) {
  const lower = hashtag.toLowerCase();
  const categoryMap = {
    'leadership': ['leadership', 'management', 'executive', 'ceo', 'founder'],
    'technology': ['tech', 'ai', 'machinelearning', 'data', 'cloud', 'software'],
    'innovation': ['innovation', 'digitaltransformation', 'disruption', 'r&d'],
    'entrepreneurship': ['entrepreneur', 'startup', 'founder', 'venture', 'funding'],
    'marketing': ['marketing', 'branding', 'advertising', 'growth', 'seo', 'content'],
    'sales': ['sales', 'selling', 'revenue', 'b2b', 'prospecting', 'closing'],
    'career': ['career', 'jobsearch', 'resume', 'interview', 'promotion'],
    'hr': ['hiring', 'recruiting', 'talent', 'hr', 'peopleops', 'culture'],
    'productivity': ['productivity', 'timemanagement', 'focus', 'efficiency', 'tools'],
    'finance': ['finance', 'fintech', 'investing', 'crypto', 'banking', 'economy'],
    'healthcare': ['healthtech', 'medtech', 'biotech', 'healthcare', 'wellness'],
    'education': ['edtech', 'learning', 'upskilling', 'training', 'certification'],
    'sustainability': ['sustainability', 'esg', 'climate', 'green', 'renewable'],
    'realestate': ['proptech', 'realestate', 'property', 'construction'],
  };
  
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  
  for (const cat of categories) {
    if (lower.includes(cat.toLowerCase())) return cat;
  }
  
  return 'professional';
}

export { detectLinkedInTrends };