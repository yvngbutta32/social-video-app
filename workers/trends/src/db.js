import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

const { Pool } = pg;

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  min: config.database.pool.min,
  max: config.database.pool.max,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

export const db = {
  query: async (text, params) => {
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug({ query: text.substring(0, 100), duration, rows: result.rowCount }, 'Query executed');
      return result;
    } catch (error) {
      logger.error({ err: error, query: text.substring(0, 100) }, 'Query failed');
      throw error;
    }
  },

  connect: async () => {
    const client = await pool.connect();
    const originalQuery = client.query.bind(client);
    client.query = async (text, params) => {
      const start = Date.now();
      try {
        const result = await originalQuery(text, params);
        const duration = Date.now() - start;
        logger.debug({ query: text.substring(0, 100), duration, rows: result.rowCount }, 'Client query executed');
        return result;
      } catch (error) {
        logger.error({ err: error, query: text.substring(0, 100) }, 'Client query failed');
        throw error;
      }
    };
    return client;
  },

  close: async () => {
    await pool.end();
    logger.info('Database pool closed');
  },

  // Health check
  healthCheck: async () => {
    try {
      const result = await pool.query('SELECT 1 as healthy');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  },

  // Get users who have trend preferences enabled
  getUsersWithTrendPreferences: async () => {
    const result = await pool.query(`
      SELECT u.id, u.email, up.preferred_platforms, up.preferred_categories, up.target_audience, up.brand_voice, up.content_pillars
      FROM users u
      JOIN user_preferences up ON u.id = up.user_id
      WHERE up.trend_concepts_enabled = true
    `);
    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      preferredPlatforms: row.preferred_platforms || ['tiktok', 'instagram', 'youtube'],
      preferredCategories: row.preferred_categories || [],
      targetAudience: row.target_audience,
      brandVoice: row.brand_voice,
      contentPillars: row.content_pillars || [],
    }));
  },

  // Get user profile for concept generation
  getUserProfile: async (userId) => {
    const result = await pool.query(`
      SELECT u.id, u.email, up.target_audience, up.brand_voice, up.content_pillars, up.preferred_platforms, up.preferred_categories
      FROM users u
      LEFT JOIN user_preferences up ON u.id = up.user_id
      WHERE u.id = $1
    `, [userId]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      targetAudience: row.target_audience || 'general',
      brandVoice: row.brand_voice || 'authentic, energetic',
      contentPillars: row.content_pillars || ['education', 'entertainment'],
      preferredPlatforms: row.preferred_platforms || ['tiktok', 'instagram', 'youtube'],
      preferredCategories: row.preferred_categories || [],
    };
  },

  // Save generated concept
  saveConcept: async (concept) => {
    const result = await pool.query(`
      INSERT INTO concepts (user_id, trend_id, hook, format, structure, visual_cues, audio_strategy, caption_strategy, hashtag_strategy, best_posting_time, predicted_viral_score, difficulty, estimated_production_time, viability_score, trend_topic, trend_platform, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      concept.userId,
      concept.trendId,
      concept.hook,
      concept.format,
      JSON.stringify(concept.structure),
      JSON.stringify(concept.visualCues),
      JSON.stringify(concept.audioStrategy),
      JSON.stringify(concept.captionStrategy),
      JSON.stringify(concept.hashtagStrategy),
      concept.bestPostingTime,
      concept.predictedViralScore,
      concept.difficulty,
      concept.estimatedProductionTime,
      concept.viabilityScore,
      concept.trendTopic,
      concept.trendPlatform,
      JSON.stringify({ generatedAt: concept.generatedAt }),
    ]);
    return result.rows[0];
  },

  // Get concepts for user
  getConceptsForUser: async (userId, limit = 20, offset = 0) => {
    const result = await pool.query(`
      SELECT c.*, t.topic as trend_topic, t.platform as trend_platform
      FROM concepts c
      JOIN trends t ON c.trend_id = t.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    return result.rows;
  },

  // Get concept by ID
  getConceptById: async (conceptId, userId) => {
    const result = await pool.query(`
      SELECT c.*, t.topic as trend_topic, t.platform as trend_platform
      FROM concepts c
      JOIN trends t ON c.trend_id = t.id
      WHERE c.id = $1 AND c.user_id = $2
    `, [conceptId, userId]);
    return result.rows[0] || null;
  },
};

export default db;
