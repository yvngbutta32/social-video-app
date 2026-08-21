-- Create remaining hypertables

-- Revenue events
CREATE TABLE IF NOT EXISTS revenue_events (
    id UUID DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (id, recorded_at)
);
SELECT create_hypertable('revenue_events', 'recorded_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_revenue_workspace ON revenue_events(workspace_id, recorded_at DESC);

-- Trend suggestions
CREATE TABLE IF NOT EXISTS trend_suggestions (
    id UUID DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source trend_source NOT NULL,
    source_id VARCHAR(255),
    title TEXT NOT NULL,
    description TEXT,
    niche VARCHAR(100),
    platform platform,
    keywords TEXT[],
    viral_potential DECIMAL(4,3),
    trend_velocity DECIMAL(6,3),
    raw_data JSONB DEFAULT '{}',
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    PRIMARY KEY (id, fetched_at)
);
SELECT create_hypertable('trend_suggestions', 'fetched_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_trends_workspace ON trend_suggestions(workspace_id, fetched_at DESC);
CREATE INDEX idx_trends_niche_platform ON trend_suggestions(niche, platform, fetched_at DESC);

-- Performance patterns
CREATE TABLE IF NOT EXISTS performance_patterns (
    id UUID DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL,
    pattern_data JSONB NOT NULL,
    confidence DECIMAL(4,3) NOT NULL,
    sample_size INTEGER NOT NULL,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    PRIMARY KEY (id, discovered_at)
);
SELECT create_hypertable('performance_patterns', 'discovered_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_patterns_workspace ON performance_patterns(workspace_id, discovered_at DESC);

-- Viral predictions
CREATE TABLE IF NOT EXISTS viral_predictions (
    id UUID DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES video_variants(id) ON DELETE SET NULL,
    prediction_type VARCHAR(50) NOT NULL,
    predicted_value DECIMAL(10,3),
    confidence_interval JSONB,
    model_version VARCHAR(50),
    features JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
);
SELECT create_hypertable('viral_predictions', 'created_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_predictions_workspace ON viral_predictions(workspace_id, created_at DESC);
CREATE INDEX idx_predictions_video ON viral_predictions(video_id, created_at DESC);

-- Usage events
CREATE TABLE IF NOT EXISTS usage_events (
    id UUID DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    properties JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
);
SELECT create_hypertable('usage_events', 'recorded_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_usage_workspace ON usage_events(workspace_id, recorded_at DESC);
CREATE INDEX idx_usage_user ON usage_events(user_id, recorded_at DESC);
CREATE INDEX idx_usage_event_type ON usage_events(event_type, recorded_at DESC);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
);
SELECT create_hypertable('audit_logs', 'created_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    status VARCHAR(50),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_subscriptions_workspace ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- Trigger for updated_at on subscriptions
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'All hypertables and tables created successfully!' as result;