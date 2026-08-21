import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../logger.js';

const YOUTUBE_TRENDING_URL = 'https://www.youtube.com/feed/trending';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';

async function detectYouTubeTrends({ keywords = [], regions = ['US'], categories = [] }) {
  const trends = [];
  
  try {
    // Use YouTube Data API if key available
    if (config.youtube.apiKey) {
      const apiTrends = await fetchYouTubeAPITrends(keywords, regions, categories);
      trends.push(...apiTrends);
    }
    
    // Also scrape trending page
    const scrapedTrends = await scrapeTrendingPage(regions[0], keywords, categories);
    trends.push(...scrapedTrends);
    
    return deduplicateTrends(trends);
  } catch (error) {
    logger.error({ err: error }, 'YouTube trend detection failed');
    return [];
  }
}

async function fetchYouTubeAPITrends(keywords, regions, categories) {
  const trends = [];
  
  for (const region of regions.slice(0, 3)) {
    try {
      // Get trending videos
      const response = await axios.get(`${YOUTUBE_API_URL}/videos`, {
        params: {
          part: 'snippet,statistics,topicDetails',
          chart: 'mostPopular',
          regionCode: region,
          maxResults: 50,
          key: config.youtube.apiKey,
        },
        timeout: 10000,
      });
      
      for (const video of response.data.items || []) {
        const hashtags = extractHashtags(video.snippet.description) || 
                         video.snippet.tags?.filter(t => t.startsWith('#')).map(t => t.replace('#', '')) || [];
        
        for (const hashtag of hashtags.slice(0, 5)) {
          if (keywords.length > 0 && !keywords.some(k => hashtag.toLowerCase().includes(k.toLowerCase()))) {
            continue;
          }
          
          trends.push({
            platform: 'youtube_shorts',
            topic: video.snippet.title,
            hashtag: hashtag,
            volume: video.statistics?.viewCount || 0,
            velocity: calculateVelocity(video.statistics?.viewCount, video.statistics?.likeCount),
            sentiment: 0.6,
            region,
            category: categorizeFromTopics(video.topicDetails?.topicCategories || [], categories),
            metadata: {
              videoId: video.id,
              channelTitle: video.snippet.channelTitle,
              publishedAt: video.snippet.publishedAt,
              duration: video.contentDetails?.duration,
            },
          });
        }
      }
    } catch (error) {
      logger.warn({ region, err: error }, 'YouTube API trending failed');
    }
  }
  
  return trends;
}

async function scrapeTrendingPage(region, keywords, categories) {
  const trends = [];
  
  try {
    const response = await axios.get(YOUTUBE_TRENDING_URL, {
      params: { gl: region.toLowerCase(), hl: 'en' },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000,
    });
    
    // Parse ytInitialData from HTML
    const ytData = extractYTInitialData(response.data);
    if (!ytData) return trends;
    
    const videos = extractVideosFromYTData(ytData);
    
    for (const video of videos.slice(0, 30)) {
      const hashtags = extractHashtags(video.description) || [];
      
      for (const hashtag of hashtags.slice(0, 3)) {
        if (keywords.length > 0 && !keywords.some(k => hashtag.toLowerCase().includes(k.toLowerCase()))) {
          continue;
        }
        
        trends.push({
          platform: 'youtube_shorts',
          topic: video.title,
          hashtag: hashtag,
          volume: video.viewCount || 0,
          velocity: calculateVelocity(video.viewCount, video.likeCount),
          sentiment: 0.6,
          region,
          category: 'trending',
          metadata: { source: 'scraped', videoId: video.videoId },
        });
      }
    }
  } catch (error) {
    logger.warn({ err: error }, 'YouTube trending page scrape failed');
  }
  
  return trends;
}

function extractYTInitialData(html) {
  const match = html.match(/var ytInitialData = ({.*?});/s);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}

function extractVideosFromYTData(data) {
  const videos = [];
  
  try {
    const contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    
    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const videoRenderer = item?.videoRenderer;
        if (videoRenderer) {
          videos.push({
            videoId: videoRenderer.videoId,
            title: videoRenderer.title?.runs?.[0]?.text || '',
            viewCount: parseViewCount(videoRenderer.viewCountText?.simpleText),
            likeCount: 0,
            description: videoRenderer.descriptionSnippet?.runs?.map(r => r.text).join('') || '',
          });
        }
      }
    }
  } catch (error) {
    // Ignore parsing errors
  }
  
  return videos;
}

function parseViewCount(text) {
  if (!text) return 0;
  const match = text.match(/([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, '')) : 0;
}

function extractHashtags(text) {
  if (!text) return [];
  return text.match(/#[\w]+/g)?.map(t => t.replace('#', '')) || [];
}

function calculateVelocity(viewCount, likeCount) {
  if (!viewCount) return 0;
  const engagement = likeCount ? likeCount / viewCount : 0.02;
  return Math.min((viewCount / 100000) * (1 + engagement * 10), 10);
}

function categorizeFromTopics(topics, categories) {
  const topicMap = {
    'music': ['/m/04rlf', '/m/02mscn'],
    'gaming': ['/m/0bzvm2'],
    'education': ['/m/01k8wb'],
    'tech': ['/m/07c1v', '/m/02p97'],
    'beauty': ['/m/03glg'],
    'fitness': ['/m/0211k'],
  };
  
  for (const [cat, ids] of Object.entries(topicMap)) {
    if (topics.some(t => ids.includes(t))) return cat;
  }
  
  for (const cat of categories) {
    if (topics.some(t => t.toLowerCase().includes(cat.toLowerCase()))) return cat;
  }
  
  return 'general';
}

function deduplicateTrends(trends) {
  const seen = new Set();
  return trends.filter(t => {
    const key = `${t.platform}-${t.hashtag}-${t.region}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export { detectYouTubeTrends };