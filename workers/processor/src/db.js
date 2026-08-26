import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

const { Pool } = pg;

export const pgPool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pgPool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pgPool.query(text, params);
  const duration = Date.now() - start;
  
  logger.debug({ query: text.substring(0, 100), duration, rows: res.rowCount }, 'Executed query');
  return res;
}

export async function getClient() {
  return await pgPool.connect();
}

export async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function close() {
  await pgPool.end();
}

// Helper functions for common operations (aligned with Prisma schema)

export async function findVideoById(videoId) {
  const result = await query(
    `SELECT v.*, u.id as uploaded_by_id, u.email as uploaded_by_email
     FROM videos v
     JOIN users u ON v.uploaded_by = u.id
     WHERE v.id = $1`,
    [videoId]
  );
  return result.rows[0];
}

export async function findWorkspaceById(workspaceId) {
  const result = await query(
    `SELECT * FROM workspaces WHERE id = $1`,
    [workspaceId]
  );
  return result.rows[0];
}

export async function findSocialAccount(accountId) {
  const result = await query(
    `SELECT sa.*, w.id as workspace_id, w.name as workspace_name
     FROM social_accounts sa
     JOIN workspaces w ON sa.workspace_id = w.id
     WHERE sa.id = $1`,
    [accountId]
  );
  return result.rows[0];
}

export async function findSocialAccountByWorkspaceAndPlatform(workspaceId, platform) {
  const result = await query(
    `SELECT * FROM social_accounts 
     WHERE workspace_id = $1 AND platform = $2 AND is_active = true
     ORDER BY connected_at DESC
     LIMIT 1`,
    [workspaceId, platform]
  );
  return result.rows[0];
}

export async function updateVideoStatus(videoId, status, metadata = {}) {
  const result = await query(
    `UPDATE videos 
     SET status = $2, metadata = jsonb_set(metadata, '{processing}', to_jsonb($3::jsonb)), updated_at = NOW(),
         processed_at = CASE WHEN $2 = 'ready' THEN NOW() ELSE processed_at END
     WHERE id = $1
     RETURNING *`,
    [videoId, status, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function updateVideoProgress(videoId, processing) {
  const result = await query(
    `UPDATE videos
     SET status = CASE WHEN $2::jsonb->>'state' = 'failed' THEN 'failed' ELSE 'processing' END,
         metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{processing}', $2::jsonb),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [videoId, JSON.stringify(processing)]
  );
  return result.rows[0];
}

export async function createVideoVariant(videoId, platform, s3Key, metadata) {
  const result = await query(
    `INSERT INTO video_variants (video_id, platform, minio_object_key, aspect_ratio, caption, hashtags, status, generation_params)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      videoId, 
      platform, 
      s3Key, 
      metadata.aspectRatio || '9:16', 
      metadata.caption || '', 
      metadata.hashtags || [],
      'ready',
      JSON.stringify(metadata)
    ]
  );
  return result.rows[0];
}

export async function findVariantForRender(variantId) {
  const result = await query(
    `SELECT vv.*, v.workspace_id, v.minio_object_key AS source_object_key, v.minio_bucket AS source_bucket,
            v.duration_seconds AS source_duration_seconds
       FROM video_variants vv
       JOIN videos v ON v.id = vv.video_id
      WHERE vv.id = $1`,
    [variantId]
  );
  return result.rows[0];
}

export async function updateVariantRenderState(variantId, state) {
  const result = await query(
    `UPDATE video_variants
        SET status = $2,
            minio_object_key = COALESCE($3, minio_object_key),
            thumbnail_object_key = COALESCE($4, thumbnail_object_key),
            duration_seconds = COALESCE($5, duration_seconds),
            width = COALESCE($6, width),
            height = COALESCE($7, height),
            file_size_bytes = COALESCE($8, file_size_bytes),
            error_message = $9,
            completed_at = CASE WHEN $2 = 'ready' THEN NOW() ELSE NULL END,
            generation_params = COALESCE(generation_params, '{}'::jsonb) || $10::jsonb
      WHERE id = $1
      RETURNING *`,
    [
      variantId,
      state.status,
      state.objectKey || null,
      state.thumbnailKey || null,
      state.durationSeconds ?? null,
      state.width ?? null,
      state.height ?? null,
      state.fileSizeBytes ?? null,
      state.errorMessage || null,
      JSON.stringify(state.generationParams || {}),
    ]
  );
  return result.rows[0];
}

export async function createScheduledPost(workspaceId, variantId, socialAccountId, scheduledAt, abTestId = null) {
  const result = await query(
    `INSERT INTO scheduled_posts (workspace_id, variant_id, social_account_id, scheduled_at, status, ab_test_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [workspaceId, variantId, socialAccountId, scheduledAt, 'scheduled', abTestId]
  );
  return result.rows[0];
}

export async function updateScheduledPostStatus(scheduledPostId, status, platformData = {}) {
  const result = await query(
    `UPDATE scheduled_posts 
     SET status = $2, platform_post_id = $3, platform_post_url = $4, error_message = $5, 
         posted_at = CASE WHEN $2 = 'posted' THEN NOW() ELSE posted_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [scheduledPostId, status, platformData.platformPostId || null, platformData.platformPostUrl || null, platformData.errorMessage || null]
  );
  return result.rows[0];
}

export async function savePostMetrics(scheduledPostId, workspaceId, platform, metrics) {
  const result = await query(
    `INSERT INTO post_metrics (scheduled_post_id, workspace_id, platform, views, likes, comments, shares, saves, clicks, reach, impressions, watch_time_seconds, avg_watch_time, completion_rate, follower_gain, profile_visits, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      scheduledPostId, workspaceId, platform,
      metrics.views || 0, metrics.likes || 0, metrics.comments || 0, metrics.shares || 0,
      metrics.saves || 0, metrics.clicks || 0, metrics.reach || 0, metrics.impressions || 0,
      metrics.watchTimeSeconds || 0, metrics.avgWatchTime || null, metrics.completionRate || null,
      metrics.followerGain || 0, metrics.profileVisits || 0, JSON.stringify(metrics.metadata || {})
    ]
  );
  return result.rows[0];
}

export async function getPendingScheduledPosts(limit = 100) {
  const result = await query(
    `SELECT sp.*, v.minio_object_key as video_s3_key, v.metadata as video_metadata,
            sa.platform, sa.access_token_encrypted, sa.refresh_token_encrypted, sa.token_expires_at,
            sa.username, sa.platform_user_id
     FROM scheduled_posts sp
     JOIN video_variants v ON sp.variant_id = v.id
     JOIN social_accounts sa ON sp.social_account_id = sa.id
     WHERE sp.status IN ('scheduled', 'posting', 'retry')
     AND sp.scheduled_at <= NOW()
     AND sa.token_expires_at > NOW()
     AND sa.is_active = true
     ORDER BY sp.scheduled_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getWorkspaceVideos(workspaceId, limit = 50, offset = 0) {
  const result = await query(
    `SELECT v.*, 
            json_agg(json_build_object('platform', vv.platform, 's3_key', vv.minio_object_key, 'status', vv.status)) as variants
     FROM videos v
     LEFT JOIN video_variants vv ON v.id = vv.video_id
     WHERE v.workspace_id = $1
     GROUP BY v.id
     ORDER BY v.created_at DESC
     LIMIT $2 OFFSET $3`,
    [workspaceId, limit, offset]
  );
  return result.rows;
}

export async function getWorkspaceAnalytics(workspaceId, days = 30) {
  const result = await query(
    `SELECT 
        platform,
        SUM(views) as total_views,
        SUM(likes) as total_likes,
        SUM(comments) as total_comments,
        SUM(shares) as total_shares,
        SUM(saves) as total_saves,
        SUM(reach) as total_reach,
        SUM(impressions) as total_impressions,
        AVG(completion_rate) as avg_completion_rate,
        SUM(follower_gain) as total_follower_gain,
        COUNT(DISTINCT scheduled_post_id) as posts_count
     FROM post_metrics
     WHERE workspace_id = $1
     AND recorded_at >= NOW() - INTERVAL '$2 days'
     GROUP BY platform
     ORDER BY total_views DESC`,
    [workspaceId, days]
  );
  return result.rows;
}

export async function getTopPerformingPosts(workspaceId, limit = 10, metric = 'views') {
  const validMetrics = ['views', 'likes', 'comments', 'shares', 'engagement_rate'];
  const orderBy = validMetrics.includes(metric) ? metric : 'views';
  
  const result = await query(
    `SELECT sp.*, v.title, vv.platform, vv.minio_object_key,
            pm.views, pm.likes, pm.comments, pm.shares, pm.saves, pm.reach, pm.impressions,
            (pm.likes + pm.comments + pm.shares + pm.saves)::float / NULLIF(pm.views, 0) as engagement_rate
     FROM scheduled_posts sp
     JOIN video_variants vv ON sp.variant_id = vv.id
     JOIN videos v ON vv.video_id = v.id
     JOIN post_metrics pm ON sp.id = pm.scheduled_post_id
     WHERE sp.workspace_id = $1
     AND sp.status = 'posted'
     AND pm.recorded_at >= NOW() - INTERVAL '30 days'
     ORDER BY pm.$2:ident DESC
     LIMIT $3`,
    [workspaceId, orderBy, limit]
  );
  return result.rows;
}

export async function recordUsageEvent(workspaceId, eventType, quantity = 1, metadata = {}) {
  const result = await query(
    `INSERT INTO usage_events (workspace_id, event_type, quantity, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [workspaceId, eventType, quantity, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function getUsageEvents(workspaceId, startDate, endDate) {
  const result = await query(
    `SELECT * FROM usage_events
     WHERE workspace_id = $1
     AND occurred_at BETWEEN $2 AND $3
     ORDER BY occurred_at DESC`,
    [workspaceId, startDate, endDate]
  );
  return result.rows;
}

export async function createABTest(workspaceId, name, hypothesis, testType, trafficSplit) {
  const result = await query(
    `INSERT INTO ab_tests (workspace_id, name, hypothesis, test_type, traffic_split, status)
     VALUES ($1, $2, $3, $4, $5, 'running')
     RETURNING *`,
    [workspaceId, name, hypothesis, testType, JSON.stringify(trafficSplit)]
  );
  return result.rows[0];
}

export async function updateABTestResults(abTestId, results, winnerVariantId, status = 'completed') {
  const result = await query(
    `UPDATE ab_tests
     SET results = $2, winner_variant_id = $3, status = $4, completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [abTestId, JSON.stringify(results), winnerVariantId, status]
  );
  return result.rows[0];
}