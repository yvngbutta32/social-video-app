/**
 * PostgreSQL database client with connection pooling
 * Handles job tracking, video metadata, and analytics
 */

import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

const { Pool } = pg;

class DbClient {
  constructor() {
    this.pool = null;
  }

  async connect() {
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    const client = await this.pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    // Set up event handlers
    this.pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected database pool error');
    });

    logger.info('Database pool connected');
  }

  async query(text, params) {
    const start = Date.now();
    const res = await this.pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ query: text.substring(0, 100), duration, rows: res.rowCount }, 'Executed query');
    return res;
  }

  async getClient() {
    return this.pool.connect();
  }

  /**
   * Create a new video processing job record
   */
  async createJob(job) {
    const sql = `
      INSERT INTO video_jobs (id, source_video_id, platform, variant, status, priority, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    const values = [
      job.id,
      job.sourceVideoId,
      job.platform,
      job.variant,
      job.status || 'pending',
      job.priority || 0,
      JSON.stringify(job.metadata || {}),
    ];
    const result = await this.query(sql, values);
    return result.rows[0];
  }

  /**
   * Update job status and progress
   */
  async updateJobStatus(jobId, status, progress = null, error = null, outputPath = null) {
    const updates = ['status = $2', 'updated_at = NOW()'];
    const values = [jobId, status];
    let paramIndex = 3;

    if (progress !== null) {
      updates.push(`progress = $${paramIndex}`);
      values.push(progress);
      paramIndex++;
    }

    if (error !== null) {
      updates.push(`error = $${paramIndex}`);
      values.push(error);
      paramIndex++;
    }

    if (outputPath !== null) {
      updates.push(`output_path = $${paramIndex}`);
      values.push(outputPath);
      paramIndex++;
    }

    if (status === 'processing' && !updates.some(u => u.startsWith('started_at'))) {
      updates.push(`started_at = NOW()`);
    }

    if (status === 'completed' || status === 'failed') {
      updates.push(`completed_at = NOW()`);
    }

    const sql = `UPDATE video_jobs SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await this.query(sql, values);
    return result.rows[0];
  }

  /**
   * Get job by ID
   */
  async getJob(jobId) {
    const sql = `SELECT * FROM video_jobs WHERE id = $1`;
    const result = await this.query(sql, [jobId]);
    return result.rows[0];
  }

  /**
   * Get jobs by source video ID
   */
  async getJobsBySourceVideo(sourceVideoId) {
    const sql = `SELECT * FROM video_jobs WHERE source_video_id = $1 ORDER BY created_at DESC`;
    const result = await this.query(sql, [sourceVideoId]);
    return result.rows;
  }

  /**
   * Create source video record
   */
  async createSourceVideo(video) {
    const sql = `
      INSERT INTO source_videos (id, user_id, original_filename, minio_path, duration, width, height, fps, file_size, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;
    const values = [
      video.id,
      video.userId,
      video.originalFilename,
      video.minioPath,
      video.duration,
      video.width,
      video.height,
      video.fps,
      video.fileSize,
      JSON.stringify(video.metadata || {}),
    ];
    const result = await this.query(sql, values);
    return result.rows[0];
  }

  /**
   * Get source video by ID
   */
  async getSourceVideo(videoId) {
    const sql = `SELECT * FROM source_videos WHERE id = $1`;
    const result = await this.query(sql, [videoId]);
    return result.rows[0];
  }

  /**
   * Record platform variant output
   */
  async createPlatformVariant(variant) {
    const sql = `
      INSERT INTO platform_variants (id, job_id, platform, variant_name, minio_path, thumbnail_path, width, height, bitrate, duration, file_size, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
    `;
    const values = [
      variant.id,
      variant.jobId,
      variant.platform,
      variant.variantName,
      variant.minioPath,
      variant.thumbnailPath,
      variant.width,
      variant.height,
      variant.bitrate,
      variant.duration,
      variant.fileSize,
    ];
    const result = await this.query(sql, values);
    return result.rows[0];
  }

  /**
   * Record publishing event
   */
  async createPublishEvent(event) {
    const sql = `
      INSERT INTO publish_events (id, variant_id, platform, platform_post_id, status, error, published_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      event.id,
      event.variantId,
      event.platform,
      event.platformPostId,
      event.status,
      event.error,
      event.publishedAt,
      JSON.stringify(event.metadata || {}),
    ];
    const result = await this.query(sql, values);
    return result.rows[0];
  }

  /**
   * Get platform credentials for user
   */
  async getPlatformCredentials(userId, platform) {
    const sql = `
      SELECT * FROM platform_credentials
      WHERE user_id = $1 AND platform = $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.query(sql, [userId, platform]);
    return result.rows[0];
  }

  /**
   * Store platform credentials (encrypted)
   */
  async storePlatformCredentials(credentials) {
    const sql = `
      INSERT INTO platform_credentials (id, user_id, platform, access_token, refresh_token, expires_at, scopes, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (user_id, platform) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        scopes = EXCLUDED.scopes,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `;
    const values = [
      credentials.id,
      credentials.userId,
      credentials.platform,
      credentials.accessToken,
      credentials.refreshToken,
      credentials.expiresAt,
      credentials.scopes,
      JSON.stringify(credentials.metadata || {}),
    ];
    const result = await this.query(sql, values);
    return result.rows[0];
  }

  /**
   * Record analytics event
   */
  async recordAnalytics(event) {
    const sql = `
      INSERT INTO analytics_events (id, user_id, video_id, variant_id, platform, event_type, event_data, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;
    const values = [
      event.id,
      event.userId,
      event.videoId,
      event.variantId,
      event.platform,
      event.eventType,
      JSON.stringify(event.eventData || {}),
    ];
    await this.query(sql, values);
  }

  /**
   * Get processing queue stats
   */
  async getQueueStats() {
    const sql = `
      SELECT
        status,
        COUNT(*) as count
      FROM video_jobs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `;
    const result = await this.query(sql);
    return result.rows;
  }

  async disconnect() {
    await this.pool.end();
    logger.info('Database pool disconnected');
  }
}

export { DbClient };
export default DbClient;