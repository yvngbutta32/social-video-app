const { Pool } = require('pg');
const config = require('../config');
const logger = require('../logger');

let pool = null;

async function getPool() {
  if (!pool) {
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl,
      max: config.database.poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });

    // Test connection
    try {
      const client = await pool.connect();
      client.release();
      logger.info('Database connection pool initialized');
    } catch (err) {
      logger.error('Failed to initialize database pool', { error: err.message });
      throw err;
    }
  }
  return pool;
}

async function query(text, params) {
  const pool = await getPool();
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('Query error', { text: text.substring(0, 100), error: err.message });
    throw err;
  }
}

async function getClient() {
  const pool = await getPool();
  return pool.connect();
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

// Initialize tables
async function initializeTables() {
  const createTables = `
    -- Enable pgvector extension for embeddings
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Viral predictions table (matches Prisma ViralPrediction model)
    CREATE TABLE IF NOT EXISTS viral_predictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL,
      video_id UUID,
      variant_id UUID,
      prediction_type VARCHAR(50) NOT NULL,
      predicted_value DECIMAL(10,3),
      confidence_interval JSONB,
      model_version VARCHAR(50),
      features JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_viral_predictions_workspace_id ON viral_predictions(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_viral_predictions_video_id ON viral_predictions(video_id);
    CREATE INDEX IF NOT EXISTS idx_viral_predictions_variant_id ON viral_predictions(variant_id);
    CREATE INDEX IF NOT EXISTS idx_viral_predictions_created_at ON viral_predictions(created_at DESC);

    -- Generated hooks table
    CREATE TABLE IF NOT EXISTS generated_hooks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id UUID NOT NULL,
      creator_id UUID NOT NULL,
      platform VARCHAR(50) NOT NULL,
      hook_type VARCHAR(50) NOT NULL,
      hook_text TEXT NOT NULL,
      hook_score DECIMAL(4,3),
      position INTEGER DEFAULT 0,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_generated_hooks_video_id ON generated_hooks(video_id);
    CREATE INDEX IF NOT EXISTS idx_generated_hooks_creator_id ON generated_hooks(creator_id);
    CREATE INDEX IF NOT EXISTS idx_generated_hooks_platform ON generated_hooks(platform);
    CREATE INDEX IF NOT EXISTS idx_generated_hooks_type ON generated_hooks(hook_type);

    -- Trend concepts table
    CREATE TABLE IF NOT EXISTS trend_concepts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trend_id UUID NOT NULL,
      creator_id UUID NOT NULL,
      platform VARCHAR(50) NOT NULL,
      concept_title VARCHAR(500) NOT NULL,
      concept_description TEXT,
      script_outline JSONB,
      visual_cues JSONB,
      audio_cues JSONB,
      hashtags TEXT[],
      estimated_duration INTEGER,
      difficulty VARCHAR(20) DEFAULT 'beginner',
      viral_potential DECIMAL(4,3),
      status VARCHAR(20) DEFAULT 'draft',
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_trend_concepts_trend_id ON trend_concepts(trend_id);
    CREATE INDEX IF NOT EXISTS idx_trend_concepts_creator_id ON trend_concepts(creator_id);
    CREATE INDEX IF NOT EXISTS idx_trend_concepts_platform ON trend_concepts(platform);
    CREATE INDEX IF NOT EXISTS idx_trend_concepts_status ON trend_concepts(status);
    CREATE INDEX IF NOT EXISTS idx_trend_concepts_viral_potential ON trend_concepts(viral_potential DESC);

    -- Video embeddings for similarity search
    CREATE TABLE IF NOT EXISTS video_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id UUID NOT NULL UNIQUE,
      creator_id UUID NOT NULL,
      platform VARCHAR(50) NOT NULL,
      embedding vector(1536),
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_video_embeddings_creator_id ON video_embeddings(creator_id);
    CREATE INDEX IF NOT EXISTS idx_video_embeddings_platform ON video_embeddings(platform);

    -- Hook templates library
    CREATE TABLE IF NOT EXISTS hook_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      hook_type VARCHAR(50) NOT NULL,
      template TEXT NOT NULL,
      variables JSONB,
      performance_score DECIMAL(4,3) DEFAULT 0.5,
      usage_count INTEGER DEFAULT 0,
      category VARCHAR(100),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_hook_templates_platform ON hook_templates(platform);
    CREATE INDEX IF NOT EXISTS idx_hook_templates_type ON hook_templates(hook_type);
    CREATE INDEX IF NOT EXISTS idx_hook_templates_performance ON hook_templates(performance_score DESC);

    -- Concept templates library
    CREATE TABLE IF NOT EXISTS concept_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      category VARCHAR(100),
      structure JSONB NOT NULL,
      placeholders JSONB,
      performance_score DECIMAL(4,3) DEFAULT 0.5,
      usage_count INTEGER DEFAULT 0,
      difficulty VARCHAR(20) DEFAULT 'beginner',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_concept_templates_platform ON concept_templates(platform);
    CREATE INDEX IF NOT EXISTS idx_concept_templates_category ON concept_templates(category);
    CREATE INDEX IF NOT EXISTS idx_concept_templates_difficulty ON concept_templates(difficulty);

    -- Retention analyses table (Phase 1: Algorithmic Intelligence)
    CREATE TABLE IF NOT EXISTS retention_analyses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scheduled_post_id UUID NOT NULL,
      workspace_id UUID NOT NULL,
      creator_id UUID NOT NULL,
      platform VARCHAR(50) NOT NULL,
      scene_data JSONB,
      drop_off_points JSONB,
      hook_effectiveness DECIMAL(4,3),
      optimal_cut_points JSONB,
      analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_retention_analyses_post_id ON retention_analyses(scheduled_post_id);
    CREATE INDEX IF NOT EXISTS idx_retention_analyses_creator_id ON retention_analyses(creator_id);
    CREATE INDEX IF NOT EXISTS idx_retention_analyses_platform ON retention_analyses(platform);

    -- Engagement velocities table (Phase 1: Real-time viral detection)
    CREATE TABLE IF NOT EXISTS engagement_velocities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scheduled_post_id UUID NOT NULL,
      workspace_id UUID NOT NULL,
      creator_id UUID NOT NULL,
      platform VARCHAR(50) NOT NULL,
      velocity_score DECIMAL(6,3),
      acceleration_score DECIMAL(6,3),
      viral_probability DECIMAL(4,3),
      time_window_minutes INTEGER,
      calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_engagement_velocities_post_id ON engagement_velocities(scheduled_post_id);
    CREATE INDEX IF NOT EXISTS idx_engagement_velocities_creator_id ON engagement_velocities(creator_id);
    CREATE INDEX IF NOT EXISTS idx_engagement_velocities_viral_prob ON engagement_velocities(viral_probability DESC);

    -- Platform ranking factors table (Phase 1: Algorithm reverse-engineering)
    CREATE TABLE IF NOT EXISTS platform_ranking_factors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform VARCHAR(50) NOT NULL,
      niche VARCHAR(100),
      factor_weights JSONB,
      sample_size INTEGER,
      confidence DECIMAL(4,3),
      discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      valid_until TIMESTAMP WITH TIME ZONE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_ranking_factors_platform_niche ON platform_ranking_factors(platform, niche);

    -- Creator algorithm profiles table (Phase 1: Per-creator optimization)
    CREATE TABLE IF NOT EXISTS creator_algorithm_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL UNIQUE,
      optimal_hook_types JSONB DEFAULT '[]',
      optimal_post_times JSONB DEFAULT '{}',
      optimal_duration JSONB DEFAULT '{}',
      retention_pattern JSONB DEFAULT '{}',
      engagement_weights JSONB DEFAULT '{}',
      viral_velocity_threshold DECIMAL(6,3) DEFAULT 0,
      platform_weights JSONB DEFAULT '{}',
      content_pillars JSONB DEFAULT '[]',
      audience_insights JSONB DEFAULT '{}',
      last_trained_at TIMESTAMP WITH TIME ZONE,
      training_data_points INTEGER DEFAULT 0,
      model_version VARCHAR(20) DEFAULT '1.0',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_creator_algorithm_profiles_creator_id ON creator_algorithm_profiles(creator_id);
  `;

  try {
    await query(createTables);
    logger.info('Database tables initialized');
  } catch (err) {
    logger.error('Failed to initialize tables', { error: err.message });
    throw err;
  }
}

// Viral Predictions (matches Prisma ViralPrediction model)
async function createViralPrediction(data) {
  const { workspace_id, video_id, variant_id, prediction_type, predicted_value, confidence_interval, model_version, features } = data;
  const result = await query(
    `INSERT INTO viral_predictions (workspace_id, video_id, variant_id, prediction_type, predicted_value, confidence_interval, model_version, features)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [workspace_id, video_id, variant_id, prediction_type, predicted_value, JSON.stringify(confidence_interval), model_version, JSON.stringify(features || {})]
  );
  return result.rows[0];
}

async function getViralPrediction(videoId, platform) {
  const result = await query(
    `SELECT * FROM viral_predictions WHERE video_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [videoId]
  );
  return result.rows[0];
}

async function getWorkspaceViralPredictions(workspaceId, limit = 50) {
  const result = await query(
    `SELECT * FROM viral_predictions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [workspaceId, limit]
  );
  return result.rows;
}

// Generated Hooks
async function createGeneratedHook(data) {
  const { video_id, creator_id, platform, hook_type, hook_text, hook_score, position, metadata } = data;
  const result = await query(
    `INSERT INTO generated_hooks (video_id, creator_id, platform, hook_type, hook_text, hook_score, position, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [video_id, creator_id, platform, hook_type, hook_text, hook_score, position, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

async function getGeneratedHooks(videoId, platform) {
  const result = await query(
    `SELECT * FROM generated_hooks WHERE video_id = $1 AND platform = $2 ORDER BY position ASC`,
    [videoId, platform]
  );
  return result.rows;
}

async function getCreatorHooks(creatorId, limit = 100) {
  const result = await query(
    `SELECT * FROM generated_hooks WHERE creator_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [creatorId, limit]
  );
  return result.rows;
}

// Trend Concepts
async function createTrendConcept(data) {
  const { trend_id, creator_id, platform, concept_title, concept_description, script_outline, visual_cues, audio_cues, hashtags, estimated_duration, difficulty, viral_potential, status, metadata } = data;
  const result = await query(
    `INSERT INTO trend_concepts (trend_id, creator_id, platform, concept_title, concept_description, script_outline, visual_cues, audio_cues, hashtags, estimated_duration, difficulty, viral_potential, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [trend_id, creator_id, platform, concept_title, concept_description, JSON.stringify(script_outline), JSON.stringify(visual_cues), JSON.stringify(audio_cues), hashtags, estimated_duration, difficulty, viral_potential, status, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

async function getTrendConcepts(trendId, platform) {
  const result = await query(
    `SELECT * FROM trend_concepts WHERE trend_id = $1 AND platform = $2 ORDER BY viral_potential DESC`,
    [trendId, platform]
  );
  return result.rows;
}

async function getCreatorTrendConcepts(creatorId, status = null, limit = 50) {
  let sql = `SELECT * FROM trend_concepts WHERE creator_id = $1`;
  const params = [creatorId];
  if (status) {
    sql += ` AND status = $2`;
    params.push(status);
  }
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  const result = await query(sql, params);
  return result.rows;
}

async function updateTrendConceptStatus(conceptId, status) {
  const result = await query(
    `UPDATE trend_concepts SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, conceptId]
  );
  return result.rows[0];
}

// Video Embeddings
async function upsertVideoEmbedding(data) {
  const { video_id, creator_id, platform, embedding, metadata } = data;
  const result = await query(
    `INSERT INTO video_embeddings (video_id, creator_id, platform, embedding, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (video_id) DO UPDATE SET
       embedding = EXCLUDED.embedding,
       metadata = EXCLUDED.metadata,
       creator_id = EXCLUDED.creator_id,
       platform = EXCLUDED.platform
     RETURNING *`,
    [video_id, creator_id, platform, `[${embedding.join(',')}]`, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

async function findSimilarVideos(embedding, creatorId, platform, limit = 10, threshold = 0.7) {
  const result = await query(
    `SELECT video_id, creator_id, platform, metadata, 1 - (embedding <=> $1) as similarity
     FROM video_embeddings
     WHERE creator_id = $2 AND platform = $3 AND 1 - (embedding <=> $1) > $4
     ORDER BY similarity DESC
     LIMIT $5`,
    [`[${embedding.join(',')}]`, creatorId, platform, threshold, limit]
  );
  return result.rows;
}

// Hook Templates
async function getHookTemplates(platform, hookType, limit = 20) {
  let sql = `SELECT * FROM hook_templates WHERE platform = $1 AND is_active = true`;
  const params = [platform];
  if (hookType) {
    sql += ` AND hook_type = $2`;
    params.push(hookType);
  }
  sql += ` ORDER BY performance_score DESC, usage_count ASC LIMIT $${params.length + 1}`;
  params.push(limit);
  const result = await query(sql, params);
  return result.rows;
}

async function updateHookTemplatePerformance(templateId, scoreIncrement) {
  await query(
    `UPDATE hook_templates SET performance_score = LEAST(1.0, performance_score + $1), usage_count = usage_count + 1 WHERE id = $2`,
    [scoreIncrement, templateId]
  );
}

// Concept Templates
async function getConceptTemplates(platform, category, difficulty, limit = 10) {
  let sql = `SELECT * FROM concept_templates WHERE platform = $1 AND is_active = true`;
  const params = [platform];
  if (category) {
    sql += ` AND category = $2`;
    params.push(category);
  }
  if (difficulty) {
    sql += ` AND difficulty = $${params.length + 1}`;
    params.push(difficulty);
  }
  sql += ` ORDER BY performance_score DESC, usage_count ASC LIMIT $${params.length + 1}`;
  params.push(limit);
  const result = await query(sql, params);
  return result.rows;
}

// Scheduled Posts (for retention analyzer)
async function getScheduledPost(postId) {
  const result = await query(
    `SELECT sp.*, v.duration_seconds, v.uploaded_by as creator_id
     FROM scheduled_posts sp
     JOIN video_variants vv ON sp.variant_id = vv.id
     JOIN videos v ON vv.video_id = v.id
     WHERE sp.id = $1`,
    [postId]
  );
  return result.rows[0];
}

module.exports = {
  query,
  getClient,
  close,
  initializeTables,
  // Viral Predictions
  createViralPrediction,
  getViralPrediction,
  getWorkspaceViralPredictions,
  // Generated Hooks
  createGeneratedHook,
  getGeneratedHooks,
  getCreatorHooks,
  // Trend Concepts
  createTrendConcept,
  getTrendConcepts,
  getCreatorTrendConcepts,
  updateTrendConceptStatus,
  // Video Embeddings
  upsertVideoEmbedding,
  findSimilarVideos,
  // Hook Templates
  getHookTemplates,
  updateHookTemplatePerformance,
  // Concept Templates
  getConceptTemplates,
  // Scheduled Posts
  getScheduledPost,
};
