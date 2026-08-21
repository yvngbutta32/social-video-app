-- ============================================================
-- Social Video App Database Schema
-- PostgreSQL 16 + TimescaleDB
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE workspace_plan AS ENUM ('free', 'pro', 'agency', 'enterprise');
CREATE TYPE video_status AS ENUM ('uploading', 'processing', 'ready', 'failed', 'archived');
CREATE TYPE variant_status AS ENUM ('pending', 'generating', 'ready', 'failed');
CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'posting', 'posted', 'failed', 'cancelled');
CREATE TYPE platform AS ENUM ('tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin');
CREATE TYPE ab_test_status AS ENUM ('running', 'completed', 'stopped');
CREATE TYPE trend_source AS ENUM ('rss', 'reddit', 'youtube', 'google_trends', 'tiktok_creative');

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- Workspaces (multi-tenant)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    plan workspace_plan DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    branding JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX idx_workspaces_slug ON workspaces(slug);

-- Workspace members
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'viewer',
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_ws_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_ws_members_user ON workspace_members(user_id);

-- Social accounts (OAuth connections)
CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform platform NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    display_name VARCHAR(255),
    avatar_url VARCHAR(500),
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[],
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    UNIQUE(workspace_id, platform, platform_user_id)
);

CREATE INDEX idx_social_accounts_workspace ON social_accounts(workspace_id);
CREATE INDEX idx_social_accounts_platform ON social_accounts(platform);

-- ============================================================
-- VIDEO & CONTENT TABLES
-- ============================================================

-- Original uploaded videos
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    title VARCHAR(500),
    description TEXT,
    original_filename VARCHAR(255),
    minio_object_key VARCHAR(500) NOT NULL,
    minio_bucket VARCHAR(100) DEFAULT 'videos',
    duration_seconds DECIMAL(10,3),
    width INTEGER,
    height INTEGER,
    fps DECIMAL(6,2),
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    status video_status DEFAULT 'uploading',
    metadata JSONB DEFAULT '{}',
    transcript TEXT,
    transcript_language VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_videos_workspace ON videos(workspace_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created ON videos(created_at DESC);

-- Platform-specific variants
CREATE TABLE video_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    platform platform NOT NULL,
    variant_type VARCHAR(50) NOT NULL, -- feed, story, reel, short, etc.
    aspect_ratio VARCHAR(20) NOT NULL, -- 9:16, 16:9, 4:5, 1:1
    hook_id UUID, -- references generated hook
    hook_text TEXT,
    caption TEXT,
    hashtags TEXT[],
    thumbnail_object_key VARCHAR(500),
    minio_object_key VARCHAR(500),
    duration_seconds DECIMAL(10,3),
    width INTEGER,
    height INTEGER,
    file_size_bytes BIGINT,
    status variant_status DEFAULT 'pending',
    generation_params JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_variants_video ON video_variants(video_id);
CREATE INDEX idx_variants_platform ON video_variants(platform);
CREATE INDEX idx_variants_status ON video_variants(status);

-- Generated hooks (AI-generated)
CREATE TABLE hooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
    niche VARCHAR(100),
    platform platform,
    hook_type VARCHAR(50), -- curiosity, authority, transformation, etc.
    hook_text TEXT NOT NULL,
    template_used VARCHAR(100),
    ai_model VARCHAR(50),
    ai_params JSONB DEFAULT '{}',
    viral_score DECIMAL(4,3), -- 0-1 predicted viral probability
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hooks_workspace ON hooks(workspace_id);
CREATE INDEX idx_hooks_video ON hooks(video_id);
CREATE INDEX idx_hooks_niche_platform ON hooks(niche, platform);

-- ============================================================
-- SCHEDULING & POSTING
-- ============================================================

-- Scheduled posts
CREATE TABLE scheduled_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES video_variants(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    status post_status DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ NOT NULL,
    posted_at TIMESTAMPTZ,
    platform_post_id VARCHAR(255),
    platform_post_url VARCHAR(500),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    ab_test_id UUID, -- nullable, for A/B test variants
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_workspace ON scheduled_posts(workspace_id);
CREATE INDEX idx_scheduled_status ON scheduled_posts(status);
CREATE INDEX idx_scheduled_time ON scheduled_posts(scheduled_at);
CREATE INDEX idx_scheduled_variant ON scheduled_posts(variant_id);

-- A/B Tests
CREATE TABLE ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    hypothesis TEXT,
    test_type VARCHAR(50), -- hook, caption, thumbnail, time, hashtag
    status ab_test_status DEFAULT 'running',
    confidence_level DECIMAL(3,2) DEFAULT 0.95,
    minimum_detectable_effect DECIMAL(4,3) DEFAULT 0.1,
    traffic_split JSONB DEFAULT '{}', -- variant_id -> percentage
    winner_variant_id UUID,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    results JSONB DEFAULT '{}'
);

CREATE INDEX idx_ab_tests_workspace ON ab_tests(workspace_id);
CREATE INDEX idx_ab_tests_status ON ab_tests(status);

-- ============================================================
-- ANALYTICS (TimescaleDB Hypertables)
-- ============================================================

-- Post metrics (time-series)
CREATE TABLE post_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheduled_post_id UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform platform NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    views BIGINT DEFAULT 0,
    likes BIGINT DEFAULT 0,
    comments BIGINT DEFAULT 0,
    shares BIGINT DEFAULT 0,
    saves BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    impressions BIGINT DEFAULT 0,
    watch_time_seconds BIGINT DEFAULT 0,
    avg_watch_time DECIMAL(10,2),
    completion_rate DECIMAL(5,4),
    follower_gain INTEGER DEFAULT 0,
    profile_visits BIGINT DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

SELECT create_hypertable('post_metrics', 'recorded_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_post_metrics_post ON post_metrics(scheduled_post_id, recorded_at DESC);
CREATE INDEX idx_post_metrics_workspace ON post_metrics(workspace_id, recorded_at DESC);
CREATE INDEX idx_post_metrics_platform ON post_metrics(platform, recorded_at DESC);

-- Retention curves (per video, per platform)
CREATE TABLE retention_curves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheduled_post_id UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform platform NOT NULL,
    percentile_10 DECIMAL(5,4),
    percentile_25 DECIMAL(5,4),
    percentile_50 DECIMAL(5,4),
    percentile_75 DECIMAL(5,4),
    percentile_90 DECIMAL(5,4),
    drop_off_points JSONB DEFAULT '[]', -- [{second: 3, retention: 0.45}, ...]
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_retention_post ON retention_curves(scheduled_post_id);

-- Revenue attribution
CREATE TABLE revenue_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    scheduled_post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL,
    customer_email VARCHAR(255),
    customer_id VARCHAR(255),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    event_type VARCHAR(50), -- purchase, subscription, upsell
    attribution_window_days INTEGER DEFAULT 30,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('revenue_events', 'occurred_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_revenue_workspace ON revenue_events(workspace_id, occurred_at DESC);
CREATE INDEX idx_revenue_post ON revenue_events(scheduled_post_id);

-- ============================================================
-- TREND DETECTION
-- ============================================================

-- Trend signals
CREATE TABLE trend_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source trend_source NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    niche VARCHAR(100),
    keywords TEXT[],
    title TEXT,
    url VARCHAR(500),
    velocity_score DECIMAL(10,3), -- growth rate
    volume_score DECIMAL(10,3), -- absolute volume
    relevance_score DECIMAL(4,3), -- 0-1 niche match
    competition_score DECIMAL(4,3), -- 0-1 saturation
    brand_safety_score DECIMAL(4,3), -- 0-1 safe
    composite_score DECIMAL(4,3), -- weighted combination
    metadata JSONB DEFAULT '{}',
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_trends_niche ON trend_signals(niche, detected_at DESC);
CREATE INDEX idx_trends_composite ON trend_signals(composite_score DESC);
CREATE INDEX idx_trends_source ON trend_signals(source, detected_at DESC);

-- Trend content suggestions
CREATE TABLE trend_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    trend_signal_id UUID NOT NULL REFERENCES trend_signals(id) ON DELETE CASCADE,
    suggested_hooks TEXT[],
    suggested_angles TEXT[],
    estimated_effort VARCHAR(20), -- low, medium, high
    priority_score DECIMAL(4,3),
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, created
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suggestions_workspace ON trend_suggestions(workspace_id, created_at DESC);

-- ============================================================
-- INTELLIGENCE LOOP (Learning)
-- ============================================================

-- Performance patterns learned per workspace
CREATE TABLE performance_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform platform NOT NULL,
    pattern_type VARCHAR(50), -- hook_type, time_slot, hashtag_cluster, caption_style
    pattern_value VARCHAR(255) NOT NULL,
    metric_name VARCHAR(50), -- views, engagement_rate, completion_rate, ctr
    metric_value DECIMAL(10,4),
    sample_size INTEGER,
    confidence DECIMAL(4,3),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, platform, pattern_type, pattern_value)
);

CREATE INDEX idx_patterns_workspace_platform ON performance_patterns(workspace_id, platform);

-- Model predictions
CREATE TABLE viral_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES video_variants(id) ON DELETE CASCADE,
    predicted_viral_score DECIMAL(4,3),
    predicted_views BIGINT,
    predicted_engagement_rate DECIMAL(6,4),
    confidence DECIMAL(4,3),
    model_version VARCHAR(50),
    features JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predictions_variant ON viral_predictions(variant_id);

-- ============================================================
-- BILLING & USAGE
-- ============================================================

-- Usage tracking
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    event_type VARCHAR(50), -- video_upload, variant_generated, post_published, ai_tokens
    quantity INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('usage_events', 'occurred_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_usage_workspace ON usage_events(workspace_id, occurred_at DESC);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    status VARCHAR(50), -- active, past_due, canceled, trialing
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_workspace ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- ============================================================
-- AUDIT & COMPLIANCE
-- ============================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('audit_logs', 'created_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE hooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

-- Helper function for RLS policies
CREATE OR REPLACE FUNCTION current_workspace_id() RETURNS UUID AS $$
    SELECT current_setting('app.current_workspace_id', true)::UUID;
$$ LANGUAGE sql STABLE;

-- Workspace policies
CREATE POLICY workspace_member_policy ON workspaces
    USING (id = current_workspace_id());

CREATE POLICY workspace_member_policy ON workspace_members
    USING (workspace_id = current_workspace_id());

-- Video policies
CREATE POLICY video_workspace_policy ON videos
    USING (workspace_id = current_workspace_id());

CREATE POLICY variant_workspace_policy ON video_variants
    USING (video_id IN (SELECT id FROM videos WHERE workspace_id = current_workspace_id()));

CREATE POLICY hook_workspace_policy ON hooks
    USING (workspace_id = current_workspace_id());

CREATE POLICY scheduled_workspace_policy ON scheduled_posts
    USING (workspace_id = current_workspace_id());

CREATE POLICY ab_test_workspace_policy ON ab_tests
    USING (workspace_id = current_workspace_id());

CREATE POLICY metrics_workspace_policy ON post_metrics
    USING (workspace_id = current_workspace_id());

CREATE POLICY revenue_workspace_policy ON revenue_events
    USING (workspace_id = current_workspace_id());

CREATE POLICY trend_suggestions_workspace_policy ON trend_suggestions
    USING (workspace_id = current_workspace_id());

CREATE POLICY patterns_workspace_policy ON performance_patterns
    USING (workspace_id = current_workspace_id());

CREATE POLICY predictions_workspace_policy ON viral_predictions
    USING (workspace_id = current_workspace_id());

CREATE POLICY usage_workspace_policy ON usage_events
    USING (workspace_id = current_workspace_id());

CREATE POLICY subscriptions_workspace_policy ON subscriptions
    USING (workspace_id = current_workspace_id());

CREATE POLICY social_accounts_workspace_policy ON social_accounts
    USING (workspace_id = current_workspace_id());

-- ============================================================
-- TRIGGERS FOR updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_posts_updated_at BEFORE UPDATE ON scheduled_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INITIAL DATA
-- ============================================================

-- Insert default hook templates
INSERT INTO hooks (workspace_id, niche, platform, hook_type, hook_text, template_used, ai_model, viral_score)
SELECT 
    '00000000-0000-0000-0000-000000000000'::UUID,
    niche,
    platform,
    hook_type,
    template,
    template,
    'system',
    0.5
FROM (VALUES
    ('general', 'tiktok', 'curiosity', 'I discovered {secret} that {result}...'),
    ('general', 'tiktok', 'authority', 'After {years} years of {expertise}, here is what nobody tells you...'),
    ('general', 'tiktok', 'transformation', 'How I went from {before} to {after} in {timeframe}...'),
    ('general', 'tiktok', 'mistake', 'Stop making this {mistake} that costs you {cost}...'),
    ('general', 'tiktok', 'contrarian', 'Everyone says {common_advice}. They are wrong. Here is why...'),
    ('general', 'instagram', 'curiosity', 'The {secret} to {result} that {authority} does not want you to know...'),
    ('general', 'instagram', 'transformation', 'My {timeframe} journey from {before} to {after}...'),
    ('general', 'youtube', 'curiosity', 'I tested {method} for {timeframe} - here is what happened...'),
    ('general', 'youtube', 'authority', 'The complete guide to {topic} that I wish I had...'),
    ('general', 'linkedin', 'authority', 'After helping {number} {audience} achieve {result}, here is the framework...'),
    ('general', 'linkedin', 'mistake', 'The #1 mistake {audience} make when {activity}...'),
    ('tech', 'tiktok', 'curiosity', 'This {lines_of_code}-line {language} script {result}...'),
    ('tech', 'tiktok', 'authority', 'Senior devs use this {pattern} pattern. Junior devs do not...'),
    ('tech', 'linkedin', 'authority', 'How we scaled {system} to {metric} with {technology}...'),
    ('business', 'tiktok', 'money', 'How I make ${amount}/{timeframe} with {business_model}...'),
    ('business', 'linkedin', 'authority', 'The {framework} framework that grew {company} from ${start} to ${end}...'),
    ('fitness', 'tiktok', 'transformation', '{timeframe} {body_part} transformation - no gym, no equipment...'),
    ('fitness', 'instagram', 'protocol', 'My exact {goal} protocol: {steps} steps, {timeframe} results...')
) AS t(niche, platform, hook_type, template)
ON CONFLICT DO NOTHING;

-- ============================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================

-- Video with variants
CREATE VIEW video_with_variants AS
SELECT 
    v.*,
    jsonb_agg(
        jsonb_build_object(
            'id', vv.id,
            'platform', vv.platform,
            'variant_type', vv.variant_type,
            'aspect_ratio', vv.aspect_ratio,
            'hook_text', vv.hook_text,
            'status', vv.status,
            'thumbnail_url', vv.thumbnail_object_key
        )
    ) FILTER (WHERE vv.id IS NOT NULL) AS variants
FROM videos v
LEFT JOIN video_variants vv ON vv.video_id = v.id
GROUP BY v.id;

-- Scheduled posts with metrics
CREATE VIEW scheduled_posts_with_metrics AS
SELECT 
    sp.*,
    vv.hook_text,
    vv.caption,
    vv.hashtags,
    vv.thumbnail_object_key,
    v.title AS video_title,
    sa.platform,
    sa.username AS platform_username,
    pm.views,
    pm.likes,
    pm.comments,
    pm.shares,
    pm.engagement_rate
FROM scheduled_posts sp
JOIN video_variants vv ON vv.id = sp.variant_id
JOIN videos v ON v.id = vv.video_id
JOIN social_accounts sa ON sa.id = sp.social_account_id
LEFT JOIN LATERAL (
    SELECT 
        views, likes, comments, shares,
        CASE WHEN views > 0 THEN (likes + comments + shares)::DECIMAL / views ELSE 0 END AS engagement_rate
    FROM post_metrics
    WHERE scheduled_post_id = sp.id
    ORDER BY recorded_at DESC
    LIMIT 1
) pm ON true;

-- Workspace analytics summary
CREATE VIEW workspace_analytics_summary AS
SELECT 
    w.id AS workspace_id,
    w.name AS workspace_name,
    COUNT(DISTINCT v.id) AS total_videos,
    COUNT(DISTINCT vv.id) AS total_variants,
    COUNT(DISTINCT sp.id) AS total_posts,
    COUNT(DISTINCT sp.id) FILTER (WHERE sp.status = 'posted') AS posted_count,
    COALESCE(SUM(pm.views), 0) AS total_views,
    COALESCE(SUM(pm.likes), 0) AS total_likes,
    COALESCE(SUM(pm.comments), 0) AS total_comments,
    COALESCE(SUM(pm.shares), 0) AS total_shares,
    COALESCE(SUM(re.amount_cents), 0) AS total_revenue_cents
FROM workspaces w
LEFT JOIN videos v ON v.workspace_id = w.id
LEFT JOIN video_variants vv ON vv.video_id = v.id
LEFT JOIN scheduled_posts sp ON sp.variant_id = vv.id
LEFT JOIN post_metrics pm ON pm.scheduled_post_id = sp.id
LEFT JOIN revenue_events re ON re.workspace_id = w.id
GROUP BY w.id, w.name;