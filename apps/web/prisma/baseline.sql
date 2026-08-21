-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'editor', 'viewer', 'creator');

-- CreateEnum
CREATE TYPE "WorkspacePlan" AS ENUM ('free', 'pro', 'agency', 'enterprise');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('uploading', 'processing', 'ready', 'failed', 'archived');

-- CreateEnum
CREATE TYPE "VariantStatus" AS ENUM ('pending', 'generating', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'scheduled', 'posting', 'posted', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin');

-- CreateEnum
CREATE TYPE "ABTestStatus" AS ENUM ('running', 'completed', 'stopped');

-- CreateEnum
CREATE TYPE "TrendSource" AS ENUM ('rss', 'reddit', 'youtube', 'google_trends', 'tiktok_creative');

-- CreateEnum
CREATE TYPE "CreatorTier" AS ENUM ('BETA', 'PRO', 'VIP');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MirrorStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryDestination" AS ENUM ('MINIO', 'S3', 'GDRIVE', 'ONEDRIVE', 'EMAIL', 'LOCAL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "used_invite_code_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "plan" "WorkspacePlan" NOT NULL DEFAULT 'free',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "branding" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "invited_by" TEXT,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3),

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "username" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "access_token_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_at" TIMESTAMP(3),

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "original_filename" TEXT,
    "minio_object_key" TEXT NOT NULL,
    "minio_bucket" TEXT NOT NULL DEFAULT 'videos',
    "duration_seconds" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "fps" DOUBLE PRECISION,
    "file_size_bytes" BIGINT,
    "mime_type" TEXT,
    "status" "VideoStatus" NOT NULL DEFAULT 'uploading',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "transcript" TEXT,
    "transcript_language" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_variants" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "variant_type" TEXT NOT NULL,
    "aspect_ratio" TEXT NOT NULL,
    "hook_id" TEXT,
    "hook_text" TEXT,
    "caption" TEXT,
    "hashtags" JSONB NOT NULL DEFAULT '[]',
    "thumbnail_object_key" TEXT,
    "minio_object_key" TEXT,
    "duration_seconds" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "file_size_bytes" BIGINT,
    "status" "VariantStatus" NOT NULL DEFAULT 'pending',
    "generation_params" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "video_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hooks" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "video_id" TEXT,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "platform" "Platform",
    "niche" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_posts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "social_account_id" TEXT NOT NULL,
    "ab_test_id" TEXT,
    "ab_test_variant" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "posted_at" TIMESTAMP(3),
    "platform_post_id" TEXT,
    "platform_url" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_tests" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT,
    "test_type" TEXT NOT NULL,
    "status" "ABTestStatus" NOT NULL DEFAULT 'running',
    "confidence_level" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "minimum_detectable_effect" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "traffic_split" JSONB NOT NULL DEFAULT '{}',
    "winner_variant_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "results" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_metrics" (
    "id" TEXT NOT NULL,
    "scheduled_post_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" BIGINT NOT NULL DEFAULT 0,
    "likes" BIGINT NOT NULL DEFAULT 0,
    "comments" BIGINT NOT NULL DEFAULT 0,
    "shares" BIGINT NOT NULL DEFAULT 0,
    "saves" BIGINT NOT NULL DEFAULT 0,
    "clicks" BIGINT NOT NULL DEFAULT 0,
    "reach" BIGINT NOT NULL DEFAULT 0,
    "impressions" BIGINT NOT NULL DEFAULT 0,
    "watch_time_seconds" BIGINT NOT NULL DEFAULT 0,
    "avg_watch_time" DOUBLE PRECISION,
    "completion_rate" DOUBLE PRECISION,
    "follower_gain" INTEGER NOT NULL DEFAULT 0,
    "profile_visits" BIGINT NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "post_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_curves" (
    "id" TEXT NOT NULL,
    "scheduled_post_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "percentile_10" DOUBLE PRECISION,
    "percentile_25" DOUBLE PRECISION,
    "percentile_50" DOUBLE PRECISION,
    "percentile_75" DOUBLE PRECISION,
    "percentile_90" DOUBLE PRECISION,
    "drop_off_points" JSONB NOT NULL DEFAULT '[]',
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_curves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "scheduled_post_id" TEXT,
    "customer_email" TEXT,
    "customer_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "event_type" TEXT,
    "attribution_window_days" INTEGER NOT NULL DEFAULT 30,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_signals" (
    "id" TEXT NOT NULL,
    "source" "TrendSource" NOT NULL,
    "source_id" TEXT NOT NULL,
    "niche" TEXT,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "title" TEXT,
    "url" TEXT,
    "velocity_score" DOUBLE PRECISION,
    "volume_score" DOUBLE PRECISION,
    "relevance_score" DOUBLE PRECISION,
    "competition_score" DOUBLE PRECISION,
    "brand_safety_score" DOUBLE PRECISION,
    "composite_score" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "trend_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_suggestions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "trend_signal_id" TEXT NOT NULL,
    "suggested_hooks" JSONB NOT NULL DEFAULT '[]',
    "suggested_angles" JSONB NOT NULL DEFAULT '[]',
    "estimated_effort" TEXT,
    "priority_score" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trend_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_patterns" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "pattern_type" TEXT NOT NULL,
    "pattern_value" TEXT NOT NULL,
    "metric_name" TEXT,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viral_predictions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "predicted_viral_score" DOUBLE PRECISION NOT NULL,
    "predicted_views" BIGINT NOT NULL,
    "predicted_engagement_rate" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model_version" TEXT NOT NULL,
    "features" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viral_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "status" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'creator',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "usedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT,
    "niche" TEXT NOT NULL,
    "bio" TEXT,
    "tier" "CreatorTier" NOT NULL DEFAULT 'BETA',
    "folder_path" TEXT NOT NULL,
    "auto_mirror" BOOLEAN NOT NULL DEFAULT true,
    "mirror_config" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_mirrors" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "original_video_id" TEXT NOT NULL,
    "variant_ids" JSONB NOT NULL DEFAULT '[]',
    "archive_path" TEXT NOT NULL,
    "mirror_status" "MirrorStatus" NOT NULL DEFAULT 'PENDING',
    "checksum" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "delivery_path" TEXT,
    "delivered_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "content_mirrors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destination" "DeliveryDestination" NOT NULL,
    "config" JSONB NOT NULL,
    "schedule" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run" TIMESTAMP(3),
    "next_run" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "metadata" JSONB NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_used_invite_code_id_key" ON "users"("used_invite_code_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_owner_id_idx" ON "workspaces"("owner_id");

-- CreateIndex
CREATE INDEX "workspaces_slug_idx" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_idx" ON "workspace_members"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "social_accounts_workspace_id_idx" ON "social_accounts"("workspace_id");

-- CreateIndex
CREATE INDEX "social_accounts_platform_idx" ON "social_accounts"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_workspace_id_platform_platform_user_id_key" ON "social_accounts"("workspace_id", "platform", "platform_user_id");

-- CreateIndex
CREATE INDEX "videos_workspace_id_idx" ON "videos"("workspace_id");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE INDEX "videos_created_at_idx" ON "videos"("created_at" DESC);

-- CreateIndex
CREATE INDEX "video_variants_video_id_idx" ON "video_variants"("video_id");

-- CreateIndex
CREATE INDEX "video_variants_platform_idx" ON "video_variants"("platform");

-- CreateIndex
CREATE INDEX "video_variants_status_idx" ON "video_variants"("status");

-- CreateIndex
CREATE INDEX "hooks_workspace_id_idx" ON "hooks"("workspace_id");

-- CreateIndex
CREATE INDEX "hooks_type_idx" ON "hooks"("type");

-- CreateIndex
CREATE INDEX "hooks_platform_idx" ON "hooks"("platform");

-- CreateIndex
CREATE INDEX "scheduled_posts_workspace_id_idx" ON "scheduled_posts"("workspace_id");

-- CreateIndex
CREATE INDEX "scheduled_posts_variant_id_idx" ON "scheduled_posts"("variant_id");

-- CreateIndex
CREATE INDEX "scheduled_posts_social_account_id_idx" ON "scheduled_posts"("social_account_id");

-- CreateIndex
CREATE INDEX "scheduled_posts_ab_test_id_idx" ON "scheduled_posts"("ab_test_id");

-- CreateIndex
CREATE INDEX "scheduled_posts_status_idx" ON "scheduled_posts"("status");

-- CreateIndex
CREATE INDEX "scheduled_posts_scheduled_at_idx" ON "scheduled_posts"("scheduled_at");

-- CreateIndex
CREATE INDEX "ab_tests_workspace_id_idx" ON "ab_tests"("workspace_id");

-- CreateIndex
CREATE INDEX "ab_tests_status_idx" ON "ab_tests"("status");

-- CreateIndex
CREATE INDEX "post_metrics_scheduled_post_id_recorded_at_idx" ON "post_metrics"("scheduled_post_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "post_metrics_workspace_id_recorded_at_idx" ON "post_metrics"("workspace_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "post_metrics_platform_recorded_at_idx" ON "post_metrics"("platform", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "retention_curves_scheduled_post_id_idx" ON "retention_curves"("scheduled_post_id");

-- CreateIndex
CREATE INDEX "revenue_events_workspace_id_occurred_at_idx" ON "revenue_events"("workspace_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "revenue_events_scheduled_post_id_idx" ON "revenue_events"("scheduled_post_id");

-- CreateIndex
CREATE INDEX "trend_signals_niche_detected_at_idx" ON "trend_signals"("niche", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "trend_signals_composite_score_idx" ON "trend_signals"("composite_score" DESC);

-- CreateIndex
CREATE INDEX "trend_signals_source_detected_at_idx" ON "trend_signals"("source", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "trend_suggestions_workspace_id_created_at_idx" ON "trend_suggestions"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "performance_patterns_workspace_id_platform_idx" ON "performance_patterns"("workspace_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "performance_patterns_workspace_id_platform_pattern_type_pat_key" ON "performance_patterns"("workspace_id", "platform", "pattern_type", "pattern_value");

-- CreateIndex
CREATE INDEX "viral_predictions_variant_id_idx" ON "viral_predictions"("variant_id");

-- CreateIndex
CREATE INDEX "usage_events_workspace_id_occurred_at_idx" ON "usage_events"("workspace_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "subscriptions_workspace_id_idx" ON "subscriptions"("workspace_id");

-- CreateIndex
CREATE INDEX "subscriptions_stripe_subscription_id_idx" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_usedById_key" ON "invite_codes"("usedById");

-- CreateIndex
CREATE INDEX "invite_codes_email_idx" ON "invite_codes"("email");

-- CreateIndex
CREATE INDEX "invite_codes_status_idx" ON "invite_codes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_user_id_key" ON "creator_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_handle_key" ON "creator_profiles"("handle");

-- CreateIndex
CREATE INDEX "creator_profiles_handle_idx" ON "creator_profiles"("handle");

-- CreateIndex
CREATE INDEX "creator_profiles_tier_idx" ON "creator_profiles"("tier");

-- CreateIndex
CREATE INDEX "content_mirrors_creator_id_idx" ON "content_mirrors"("creator_id");

-- CreateIndex
CREATE INDEX "content_mirrors_mirror_status_idx" ON "content_mirrors"("mirror_status");

-- CreateIndex
CREATE INDEX "content_mirrors_created_at_idx" ON "content_mirrors"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_configs_name_key" ON "delivery_configs"("name");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_idx" ON "admin_audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_variants" ADD CONSTRAINT "video_variants_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hooks" ADD CONSTRAINT "hooks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hooks" ADD CONSTRAINT "hooks_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "video_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_ab_test_id_fkey" FOREIGN KEY ("ab_test_id") REFERENCES "ab_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_scheduled_post_id_fkey" FOREIGN KEY ("scheduled_post_id") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_curves" ADD CONSTRAINT "retention_curves_scheduled_post_id_fkey" FOREIGN KEY ("scheduled_post_id") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_curves" ADD CONSTRAINT "retention_curves_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_scheduled_post_id_fkey" FOREIGN KEY ("scheduled_post_id") REFERENCES "scheduled_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trend_suggestions" ADD CONSTRAINT "trend_suggestions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trend_suggestions" ADD CONSTRAINT "trend_suggestions_trend_signal_id_fkey" FOREIGN KEY ("trend_signal_id") REFERENCES "trend_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_patterns" ADD CONSTRAINT "performance_patterns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viral_predictions" ADD CONSTRAINT "viral_predictions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viral_predictions" ADD CONSTRAINT "viral_predictions_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "video_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_mirrors" ADD CONSTRAINT "content_mirrors_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_mirrors" ADD CONSTRAINT "content_mirrors_original_video_id_fkey" FOREIGN KEY ("original_video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

