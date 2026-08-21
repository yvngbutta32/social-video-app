/**
 * Intelligence Service Client
 * Communicates with the intelligence worker for viral predictions and hook generation
 */
import axios from 'axios';
import config from '../config.js';
import logger from '../logger.js';

const client = axios.create({
  baseURL: config.API_GATEWAY_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Secret': config.API_GATEWAY_SECRET,
  },
});

/**
 * Request viral prediction for a variant
 */
export async function predictViralPotential(data) {
  try {
    const response = await client.post('/api/intelligence/viral-prediction', data);
    return response.data;
  } catch (error) {
    logger.error('Viral prediction request failed', { error: error.message, data });
    // Return fallback prediction
    return {
      viralScore: 0.5,
      predictedViews: 1000,
      engagementRate: 0.03,
      confidence: 0.3,
      modelVersion: 'fallback',
      features: {},
    };
  }
}

/**
 * Request hook generation for a niche/platform
 */
export async function generateHooks(data) {
  try {
    const response = await client.post('/api/intelligence/hooks/generate', data);
    return response.data.hooks || [];
  } catch (error) {
    logger.error('Hook generation request failed', { error: error.message, data });
    return [];
  }
}

/**
 * Request concept generation for a niche
 */
export async function generateConcepts(data) {
  try {
    const response = await client.post('/api/intelligence/concepts/generate', data);
    return response.data.concepts || [];
  } catch (error) {
    logger.error('Concept generation request failed', { error: error.message, data });
    return [];
  }
}

/**
 * Request trend analysis for a niche
 */
export async function getTrends(data) {
  try {
    const response = await client.post('/api/intelligence/trends', data);
    return response.data.trends || [];
  } catch (error) {
    logger.error('Trend analysis request failed', { error: error.message, data });
    return [];
  }
}

// Export a simplified client interface
export const viralPredictorClient = {
  predict: predictViralPotential,
};

export const hooksClient = {
  generate: generateHooks,
};

export const conceptsClient = {
  generate: generateConcepts,
};

export const trendsClient = {
  getTrends,
};

export default {
  viralPredictorClient,
  hooksClient,
  conceptsClient,
  trendsClient,
};