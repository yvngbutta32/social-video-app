/**
 * Campaign Orchestrator Database Layer
 * PostgreSQL connection pool with campaign-specific queries
 */
import pg from 'pg';
import config from './config.js';
import logger from './logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.WORKER_CONCURRENCY + 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
  return res;
}

async function getClient() {
  return pool.connect();
}

async function initializeTables() {
  // Tables are managed by Prisma in the API gateway
  // This worker only reads/writes to existing tables
  logger.info('Database connection pool initialized');
  return true;
}

// ============================================================
// CAMPAIGN QUERIES
// ============================================================

/**
 * Create a new campaign record
 */
async function createCampaign(data) {
  const {
    workspaceId,
    videoId,
    name,
    platforms,
    status = 'pending',
    settings = {},
    abTestEnabled = false,
  } = data;

  const result = await query(
    `INSERT INTO campaigns (workspace_id, video_id, name, platforms, status, settings, ab_test_enabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [workspaceId, videoId, name, platforms, status, JSON.stringify(settings), abTestEnabled]
  );
  return result.rows[0];
}

/**
 * Get campaign by ID
 */
async function getCampaign(campaignId) {
  const result = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  return result.rows[0];
}

/**
 * Update campaign status
 */
async function updateCampaignStatus(campaignId, status, extraData = {}) {
  const sets = ['status = $2', 'updated_at = NOW()'];
  const params = [campaignId, status];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(extraData)) {
    sets.push(`${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  const result = await query(
    `UPDATE campaigns SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return result.rows[0];
}

/**
 * Get pending campaigns
 */
async function getPendingCampaigns(limit = 10) {
  const result = await query(
    `SELECT * FROM campaigns 
     WHERE status IN ('pending', 'processing') 
     AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at ASC 
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// ============================================================
// CAMPAIGN VARIANT QUERIES
// ============================================================

/**
 * Create campaign variants (platform-specific versions)
 */
async function createCampaignVariants(campaignId, variants) {
  const values = variants.map((v, i) => 
    `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`
  ).join(', ');

  const params = variants.flatMap(v => [
    campaignId,
    v.platform,
    v.variantType,
    v.aspectRatio,
    v.hookId || null,
    v.hookText || null,
    v.caption || null,
    v.hashtags || [],
  ]);

  const result = await query(
    `INSERT INTO campaign_variants (campaign_id, platform, variant_type, aspect_ratio, hook_id, hook_text, caption, hashtags, status, created_at)
     VALUES ${values}
     RETURNING *`,
    params
  );
  return result.rows;
}

/**
 * Get campaign variants
 */
async function getCampaignVariants(campaignId) {
  const result = await query(
    'SELECT * FROM campaign_variants WHERE campaign_id = $1 ORDER BY platform, variant_type',
    [campaignId]
  );
  return result.rows;
}

/**
 * Update variant status
 */
async function updateVariantStatus(variantId, status, extraData = {}) {
  const sets = ['status = $2', 'updated_at = NOW()'];
  const params = [variantId, status];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(extraData)) {
    sets.push(`${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  const result = await query(
    `UPDATE campaign_variants SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return result.rows[0];
}

// ============================================================
// SCHEDULED POST QUERIES
// ============================================================

/**
 * Create scheduled posts for variants
 */
async function createScheduledPosts(posts) {
  const values = posts.map((p, i) => 
    `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`
  ).join(', ');

  const params = posts.flatMap(p => [
    p.workspaceId,
    p.variantId,
    p.socialAccountId,
    p.scheduledAt,
    p.status || 'scheduled',
    p.abTestId || null,
    p.abTestVariant || null,
    p.platformPostId || null,
    JSON.stringify(p.metadata || {}),
  ]);

  const result = await query(
    `INSERT INTO scheduled_posts (workspace_id, variant_id, social_account_id, scheduled_at, status, ab_test_id, ab_test_variant, platform_post_id, metadata, created_at, updated_at)
     VALUES ${values}
     RETURNING *`,
    params
  );
  return result.rows;
}

/**
 * Get scheduled posts for a campaign
 */
async function getCampaignScheduledPosts(campaignId) {
  const result = await query(
    `SELECT sp.*, cv.platform, cv.variant_type
     FROM scheduled_posts sp
     JOIN campaign_variants cv ON sp.variant_id = cv.id
     WHERE cv.campaign_id = $1
     ORDER BY sp.scheduled_at ASC`,
    [campaignId]
  );
  return result.rows;
}

/**
 * Update scheduled post status
 */
async function updateScheduledPostStatus(postId, status, extraData = {}) {
  const sets = ['status = $2', 'updated_at = NOW()'];
  const params = [postId, status];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(extraData)) {
    sets.push(`${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  const result = await query(
    `UPDATE scheduled_posts SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return result.rows[0];
}

// ============================================================
// A/B TEST QUERIES
// ============================================================

/**
 * Create A/B test for campaign
 */
async function createABTest(data) {
  const {
    campaignId,
    workspaceId,
    name,
    hypothesis,
    testType = 'hook',
    trafficSplit = {},
    confidenceLevel = 0.95,
    minimumDetectableEffect = 0.1,
  } = data;

  const result = await query(
    `INSERT INTO ab_tests (campaign_id, workspace_id, name, hypothesis, test_type, traffic_split, confidence_level, minimum_detectable_effect, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'running', NOW(), NOW())
     RETURNING *`,
    [campaignId, workspaceId, name, hypothesis, testType, JSON.stringify(trafficSplit), confidenceLevel, minimumDetectableEffect]
  );
  return result.rows[0];
}

/**
 * Get A/B test by ID
 */
async function getABTest(testId) {
  const result = await query('SELECT * FROM ab_tests WHERE id = $1', [testId]);
  return result.rows[0];
}

/**
 * Complete A/B test
 */
async function completeABTest(testId, winnerVariantId, results) {
  const result = await query(
    `UPDATE ab_tests 
     SET status = 'completed', winner_variant_id = $2, results = $3, completed_at = NOW(), updated_at = NOW()
     WHERE id = $1 
     RETURNING *`,
    [testId, winnerVariantId, JSON.stringify(results)]
  );
  return result.rows[0];
}

// ============================================================
// SOCIAL ACCOUNT QUERIES
// ============================================================

/**
 * Get active social accounts for workspace
 */
async function getActiveSocialAccounts(workspaceId, platforms = []) {
  let queryText = 'SELECT * FROM social_accounts WHERE workspace_id = $1 AND is_active = true';
  const params = [workspaceId];

  if (platforms.length > 0) {
    queryText += ` AND platform = ANY($2)`;
    params.push(platforms);
  }

  queryText += ' ORDER BY platform, connected_at DESC';

  const result = await query(queryText, params);
  return result.rows;
}

// ============================================================
// VIRAL PREDICTION QUERIES
// ============================================================

/**
 * Get viral prediction for variant
 */
async function getViralPrediction(variantId) {
  const result = await query(
    'SELECT * FROM viral_predictions WHERE variant_id = $1 ORDER BY created_at DESC LIMIT 1',
    [variantId]
  );
  return result.rows[0];
}

/**
 * Save viral prediction
 */
async function saveViralPrediction(data) {
  const {
    workspaceId,
    variantId,
    predictedViralScore,
    predictedViews,
    predictedEngagementRate,
    confidence,
    modelVersion,
    features,
  } = data;

  const result = await query(
    `INSERT INTO viral_predictions (workspace_id, variant_id, predicted_viral_score, predicted_views, predicted_engagement_rate, confidence, model_version, features, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING *`,
    [workspaceId, variantId, predictedViralScore, predictedViews, predictedEngagementRate, confidence, modelVersion, JSON.stringify(features)]
  );
  return result.rows[0];
}

// ============================================================
// ANALYTICS QUERIES
// ============================================================

/**
 * Get post metrics for campaign
 */
async function getCampaignMetrics(campaignId) {
  const result = await query(
    `SELECT pm.*, sp.platform_post_id, cv.platform, cv.variant_type
     FROM post_metrics pm
     JOIN scheduled_posts sp ON pm.scheduled_post_id = sp.id
     JOIN campaign_variants cv ON sp.variant_id = cv.id
     WHERE cv.campaign_id = $1
     ORDER BY pm.recorded_at DESC`,
    [campaignId]
  );
  return result.rows;
}

async function close() {
  await pool.end();
  logger.info('Database pool closed');
}

export default {
  query,
  getClient,
  initializeTables,
  createCampaign,
  getCampaign,
  updateCampaignStatus,
  getPendingCampaigns,
  createCampaignVariants,
  getCampaignVariants,
  updateVariantStatus,
  createScheduledPosts,
  getCampaignScheduledPosts,
  updateScheduledPostStatus,
  createABTest,
  getABTest,
  completeABTest,
  getActiveSocialAccounts,
  getViralPrediction,
  saveViralPrediction,
  getCampaignMetrics,
  close,
};