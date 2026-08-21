/**
 * Processor Service Client
 * Communicates with the video processor worker for FFmpeg operations
 */
import axios from 'axios';
import config from '../config.js';
import logger from '../logger.js';

const client = axios.create({
  baseURL: config.API_GATEWAY_URL,
  timeout: 30000, // Longer timeout for video processing
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Secret': config.API_GATEWAY_SECRET,
  },
});

/**
 * Request video variant creation (FFmpeg processing)
 */
export async function createVariant(data) {
  try {
    const response = await client.post('/api/processor/variants', data);
    return response.data;
  } catch (error) {
    logger.error('Create variant request failed', { error: error.message, data });
    throw error;
  }
}

/**
 * Request video metadata extraction
 */
export async function getVideoMetadata(data) {
  try {
    const response = await client.post('/api/processor/metadata', data);
    return response.data;
  } catch (error) {
    logger.error('Get video metadata request failed', { error: error.message, data });
    throw error;
  }
}

/**
 * Request video download from URL
 */
export async function downloadVideo(data) {
  try {
    const response = await client.post('/api/processor/download', data);
    return response.data;
  } catch (error) {
    logger.error('Download video request failed', { error: error.message, data });
    throw error;
  }
}

/**
 * Request thumbnail generation
 */
export async function generateThumbnail(data) {
  try {
    const response = await client.post('/api/processor/thumbnail', data);
    return response.data;
  } catch (error) {
    logger.error('Generate thumbnail request failed', { error: error.message, data });
    throw error;
  }
}

/**
 * Check processing job status
 */
export async function getJobStatus(jobId) {
  try {
    const response = await client.get(`/api/processor/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    logger.error('Get job status request failed', { error: error.message, jobId });
    throw error;
  }
}

export const processorClient = {
  createVariant,
  getVideoMetadata,
  downloadVideo,
  generateThumbnail,
  getJobStatus,
};

export default processorClient;