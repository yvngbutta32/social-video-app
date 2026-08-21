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

-- DropForeignKey
ALTER TABLE "ab_tests" DROP CONSTRAINT "ab_tests_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "hooks" DROP CONSTRAINT "hooks_video_id_fkey";

-- DropForeignKey
ALTER TABLE "hooks" DROP CONSTRAINT "hooks_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "performance_patterns" DROP CONSTRAINT "performance_patterns_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "post_metrics" DROP CONSTRAINT "post_metrics_scheduled_post_id_fkey";

-- DropForeignKey
ALTER TABLE "post_metrics" DROP CONSTRAINT "post_metrics_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "revenue_events" DROP CONSTRAINT "revenue_events_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduled_posts" DROP CONSTRAINT "scheduled_posts_social_account_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduled_posts" DROP CONSTRAINT "scheduled_posts_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduled_posts" DROP CONSTRAINT "scheduled_posts_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "social_accounts" DROP CONSTRAINT "social_accounts_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "trend_suggestions" DROP CONSTRAINT "trend_suggestions_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "usage_events" DROP CONSTRAINT "usage_events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "usage_events" DROP CONSTRAINT "usage_events_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "video_variants" DROP CONSTRAINT "video_variants_video_id_fkey";

-- DropForeignKey
ALTER TABLE "videos" DROP CONSTRAINT "videos_uploaded_by_fkey";

-- DropForeignKey
ALTER TABLE "videos" DROP CONSTRAINT "videos_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "viral_predictions" DROP CONSTRAINT "viral_predictions_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "viral_predictions" DROP CONSTRAINT "viral_predictions_video_id_fkey";

-- DropForeignKey
ALTER TABLE "viral_predictions" DROP CONSTRAINT "viral_predictions_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_invited_by_fkey";

-- DropForeignKey
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_owner_id_fkey";

-- DropIndex
DROP INDEX "audit_logs_created_at_idx";

-- DropIndex
DROP INDEX "idx_hooks_niche_platform";

-- DropIndex
DROP INDEX "idx_hooks_video";

-- DropIndex
DROP INDEX "idx_patterns_workspace";

-- DropIndex
DROP INDEX "performance_patterns_discovered_at_idx";

-- DropIndex
DROP INDEX "post_metrics_recorded_at_idx";

-- DropIndex
DROP INDEX "idx_revenue_workspace";

-- DropIndex
DROP INDEX "revenue_events_recorded_at_idx";

-- DropIndex
DROP INDEX "idx_trends_niche_platform";

-- DropIndex
DROP INDEX "idx_trends_workspace";

-- DropIndex
DROP INDEX "trend_suggestions_fetched_at_idx";

-- DropIndex
DROP INDEX "idx_usage_event_type";

-- DropIndex
DROP INDEX "idx_usage_user";

-- DropIndex
DROP INDEX "idx_usage_workspace";

-- DropIndex
DROP INDEX "usage_events_recorded_at_idx";

-- DropIndex
DROP INDEX "idx_predictions_video";

-- DropIndex
DROP INDEX "idx_predictions_workspace";

-- DropIndex
DROP INDEX "viral_predictions_created_at_idx";

-- AlterTable
ALTER TABLE "ab_tests" DROP CONSTRAINT "ab_tests_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "test_type" SET NOT NULL,
ALTER COLUMN "test_type" SET DATA TYPE TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "ABTestStatus" NOT NULL DEFAULT 'running',
ALTER COLUMN "confidence_level" SET NOT NULL,
ALTER COLUMN "confidence_level" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "minimum_detectable_effect" SET NOT NULL,
ALTER COLUMN "minimum_detectable_effect" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "traffic_split" SET NOT NULL,
ALTER COLUMN "winner_variant_id" SET DATA TYPE TEXT,
ALTER COLUMN "started_at" SET NOT NULL,
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "results" SET NOT NULL,
ADD CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "action" SET DATA TYPE TEXT,
ALTER COLUMN "resource_type" SET DATA TYPE TEXT,
ALTER COLUMN "resource_id" SET DATA TYPE TEXT,
ALTER COLUMN "ip_address" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "hooks" DROP CONSTRAINT "hooks_pkey",
DROP COLUMN "ai_model",
DROP COLUMN "ai_params",
DROP COLUMN "hook_text",
DROP COLUMN "hook_type",
DROP COLUMN "template_used",
DROP COLUMN "viral_score",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "text" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "video_id" SET DATA TYPE TEXT,
ALTER COLUMN "niche" SET DATA TYPE TEXT,
DROP COLUMN "platform",
ADD COLUMN     "platform" "Platform",
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "hooks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "performance_patterns" DROP CONSTRAINT "performance_patterns_pkey",
DROP COLUMN "discovered_at",
DROP COLUMN "pattern_data",
DROP COLUMN "sample_size",
DROP COLUMN "valid_until",
ADD COLUMN     "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "metric_name" TEXT,
ADD COLUMN     "metric_value" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "pattern_value" TEXT NOT NULL,
ADD COLUMN     "platform" "Platform" NOT NULL,
ADD COLUMN     "sampleSize" INTEGER NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "pattern_type" SET DATA TYPE TEXT,
ALTER COLUMN "confidence" SET DATA TYPE DOUBLE PRECISION,
ADD CONSTRAINT "performance_patterns_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "post_metrics" DROP CONSTRAINT "post_metrics_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "scheduled_post_id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
DROP COLUMN "platform",
ADD COLUMN     "platform" "Platform" NOT NULL,
ALTER COLUMN "recorded_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "views" SET NOT NULL,
ALTER COLUMN "likes" SET NOT NULL,
ALTER COLUMN "comments" SET NOT NULL,
ALTER COLUMN "shares" SET NOT NULL,
ALTER COLUMN "saves" SET NOT NULL,
ALTER COLUMN "clicks" SET NOT NULL,
ALTER COLUMN "reach" SET NOT NULL,
ALTER COLUMN "impressions" SET NOT NULL,
ALTER COLUMN "watch_time_seconds" SET NOT NULL,
ALTER COLUMN "avg_watch_time" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "completion_rate" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "follower_gain" SET NOT NULL,
ALTER COLUMN "profile_visits" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL,
ADD CONSTRAINT "post_metrics_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "revenue_events" DROP CONSTRAINT "revenue_events_pkey",
DROP COLUMN "recorded_at",
DROP COLUMN "source",
ADD COLUMN     "attribution_window_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "customer_email" TEXT,
ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "event_type" TEXT,
ADD COLUMN     "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "scheduled_post_id" TEXT,
ADD COLUMN     "utm_campaign" TEXT,
ADD COLUMN     "utm_content" TEXT,
ADD COLUMN     "utm_medium" TEXT,
ADD COLUMN     "utm_source" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "currency" SET NOT NULL,
ALTER COLUMN "currency" SET DATA TYPE TEXT,
ALTER COLUMN "metadata" SET NOT NULL,
ADD CONSTRAINT "revenue_events_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "scheduled_posts" DROP CONSTRAINT "scheduled_posts_pkey",
DROP COLUMN "max_retries",
DROP COLUMN "platform_post_url",
ADD COLUMN     "ab_test_variant" TEXT,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "platform_url" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "variant_id" SET DATA TYPE TEXT,
ALTER COLUMN "social_account_id" SET DATA TYPE TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "PostStatus" NOT NULL DEFAULT 'draft',
ALTER COLUMN "scheduled_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "posted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "platform_post_id" SET DATA TYPE TEXT,
ALTER COLUMN "retry_count" SET NOT NULL,
ALTER COLUMN "ab_test_id" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "social_accounts" DROP CONSTRAINT "social_accounts_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
DROP COLUMN "platform",
ADD COLUMN     "platform" "Platform" NOT NULL,
ALTER COLUMN "platform_user_id" SET DATA TYPE TEXT,
ALTER COLUMN "username" SET DATA TYPE TEXT,
ALTER COLUMN "display_name" SET DATA TYPE TEXT,
ALTER COLUMN "avatar_url" SET DATA TYPE TEXT,
ALTER COLUMN "token_expires_at" SET DATA TYPE TIMESTAMP(3),
DROP COLUMN "scopes",
ADD COLUMN     "scopes" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "metadata" SET NOT NULL,
ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "connected_at" SET NOT NULL,
ALTER COLUMN "connected_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_sync_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "stripe_customer_id" SET DATA TYPE TEXT,
ALTER COLUMN "stripe_subscription_id" SET DATA TYPE TEXT,
ALTER COLUMN "stripe_price_id" SET DATA TYPE TEXT,
ALTER COLUMN "status" SET DATA TYPE TEXT,
ALTER COLUMN "current_period_start" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "current_period_end" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "cancel_at_period_end" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "trend_suggestions" DROP CONSTRAINT "trend_suggestions_pkey",
DROP COLUMN "description",
DROP COLUMN "expires_at",
DROP COLUMN "fetched_at",
DROP COLUMN "keywords",
DROP COLUMN "niche",
DROP COLUMN "platform",
DROP COLUMN "raw_data",
DROP COLUMN "source",
DROP COLUMN "source_id",
DROP COLUMN "title",
DROP COLUMN "trend_velocity",
DROP COLUMN "viral_potential",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "estimated_effort" TEXT,
ADD COLUMN     "priority_score" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "suggested_angles" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "suggested_hooks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "trend_signal_id" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "trend_suggestions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "usage_events" DROP CONSTRAINT "usage_events_pkey",
DROP COLUMN "properties",
DROP COLUMN "recorded_at",
DROP COLUMN "resource_id",
DROP COLUMN "resource_type",
DROP COLUMN "user_id",
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "event_type" SET DATA TYPE TEXT,
ADD CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "email_verified",
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'viewer',
ADD COLUMN     "used_invite_code_id" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "email" SET DATA TYPE TEXT,
ALTER COLUMN "password_hash" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "avatar_url" SET DATA TYPE TEXT,
ALTER COLUMN "timezone" SET NOT NULL,
ALTER COLUMN "timezone" SET DATA TYPE TEXT,
ALTER COLUMN "locale" SET NOT NULL,
ALTER COLUMN "locale" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_login_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "is_active" SET NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "video_variants" DROP CONSTRAINT "video_variants_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "video_id" SET DATA TYPE TEXT,
DROP COLUMN "platform",
ADD COLUMN     "platform" "Platform" NOT NULL,
ALTER COLUMN "variant_type" SET DATA TYPE TEXT,
ALTER COLUMN "aspect_ratio" SET DATA TYPE TEXT,
ALTER COLUMN "hook_id" SET DATA TYPE TEXT,
DROP COLUMN "hashtags",
ADD COLUMN     "hashtags" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "thumbnail_object_key" SET DATA TYPE TEXT,
ALTER COLUMN "minio_object_key" SET DATA TYPE TEXT,
ALTER COLUMN "duration_seconds" SET DATA TYPE DOUBLE PRECISION,
DROP COLUMN "status",
ADD COLUMN     "status" "VariantStatus" NOT NULL DEFAULT 'pending',
ALTER COLUMN "generation_params" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "video_variants_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "videos" DROP CONSTRAINT "videos_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "uploaded_by" SET DATA TYPE TEXT,
ALTER COLUMN "title" SET DATA TYPE TEXT,
ALTER COLUMN "original_filename" SET DATA TYPE TEXT,
ALTER COLUMN "minio_object_key" SET DATA TYPE TEXT,
ALTER COLUMN "minio_bucket" SET NOT NULL,
ALTER COLUMN "minio_bucket" SET DATA TYPE TEXT,
ALTER COLUMN "duration_seconds" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "fps" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "mime_type" SET DATA TYPE TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "VideoStatus" NOT NULL DEFAULT 'uploading',
ALTER COLUMN "metadata" SET NOT NULL,
ALTER COLUMN "transcript_language" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "processed_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "viral_predictions" DROP CONSTRAINT "viral_predictions_pkey",
DROP COLUMN "confidence_interval",
DROP COLUMN "predicted_value",
DROP COLUMN "prediction_type",
DROP COLUMN "video_id",
ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "predicted_engagement_rate" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "predicted_views" BIGINT NOT NULL,
ADD COLUMN     "predicted_viral_score" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "variant_id" SET NOT NULL,
ALTER COLUMN "variant_id" SET DATA TYPE TEXT,
ALTER COLUMN "model_version" SET NOT NULL,
ALTER COLUMN "model_version" SET DATA TYPE TEXT,
ALTER COLUMN "features" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "viral_predictions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "workspace_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'viewer',
ALTER COLUMN "invited_by" SET DATA TYPE TEXT,
ALTER COLUMN "invited_at" SET NOT NULL,
ALTER COLUMN "invited_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "joined_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "slug" SET DATA TYPE TEXT,
ALTER COLUMN "owner_id" SET DATA TYPE TEXT,
DROP COLUMN "plan",
ADD COLUMN     "plan" "WorkspacePlan" NOT NULL DEFAULT 'free',
ALTER COLUMN "settings" SET NOT NULL,
ALTER COLUMN "branding" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");

-- DropEnum
DROP TYPE "ab_test_status";

-- DropEnum
DROP TYPE "platform";

-- DropEnum
DROP TYPE "post_status";

-- DropEnum
DROP TYPE "trend_source";

-- DropEnum
DROP TYPE "user_role";

-- DropEnum
DROP TYPE "variant_status";

-- DropEnum
DROP TYPE "video_status";

-- DropEnum
DROP TYPE "workspace_plan";

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

-- CreateIndex
CREATE INDEX "retention_curves_scheduled_post_id_idx" ON "retention_curves"("scheduled_post_id");

-- CreateIndex
CREATE INDEX "trend_signals_niche_detected_at_idx" ON "trend_signals"("niche", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "trend_signals_composite_score_idx" ON "trend_signals"("composite_score" DESC);

-- CreateIndex
CREATE INDEX "trend_signals_source_detected_at_idx" ON "trend_signals"("source", "detected_at" DESC);

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
CREATE INDEX "ab_tests_status_idx" ON "ab_tests"("status");

-- CreateIndex
CREATE INDEX "hooks_type_idx" ON "hooks"("type");

-- CreateIndex
CREATE INDEX "hooks_platform_idx" ON "hooks"("platform");

-- CreateIndex
CREATE INDEX "performance_patterns_workspace_id_platform_idx" ON "performance_patterns"("workspace_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "performance_patterns_workspace_id_platform_pattern_type_pat_key" ON "performance_patterns"("workspace_id", "platform", "pattern_type", "pattern_value");

-- CreateIndex
CREATE INDEX "post_metrics_platform_recorded_at_idx" ON "post_metrics"("platform", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "revenue_events_workspace_id_occurred_at_idx" ON "revenue_events"("workspace_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "revenue_events_scheduled_post_id_idx" ON "revenue_events"("scheduled_post_id");

-- CreateIndex
CREATE INDEX "scheduled_posts_social_account_id_idx" ON "scheduled_posts"("social_account_id");

-- CreateIndex
CREATE INDEX "scheduled_posts_ab_test_id_idx" ON "scheduled_posts"("ab_test_id");

-- CreateIndex
CREATE INDEX "scheduled_posts_status_idx" ON "scheduled_posts"("status");

-- CreateIndex
CREATE INDEX "social_accounts_platform_idx" ON "social_accounts"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_workspace_id_platform_platform_user_id_key" ON "social_accounts"("workspace_id", "platform", "platform_user_id");

-- CreateIndex
CREATE INDEX "trend_suggestions_workspace_id_created_at_idx" ON "trend_suggestions"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "usage_events_workspace_id_occurred_at_idx" ON "usage_events"("workspace_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "users_used_invite_code_id_key" ON "users"("used_invite_code_id");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "video_variants_platform_idx" ON "video_variants"("platform");

-- CreateIndex
CREATE INDEX "video_variants_status_idx" ON "video_variants"("status");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE INDEX "viral_predictions_variant_id_idx" ON "viral_predictions"("variant_id");

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

-- RenameIndex
ALTER INDEX "idx_ab_tests_status" RENAME TO "ab_tests_status_idx";

-- RenameIndex
ALTER INDEX "idx_ab_tests_workspace" RENAME TO "ab_tests_workspace_id_idx";

-- RenameIndex
ALTER INDEX "idx_audit_action" RENAME TO "audit_logs_action_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_audit_user" RENAME TO "audit_logs_user_id_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_audit_workspace" RENAME TO "audit_logs_workspace_id_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_hooks_workspace" RENAME TO "hooks_workspace_id_idx";

-- RenameIndex
ALTER INDEX "idx_post_metrics_platform" RENAME TO "post_metrics_platform_recorded_at_idx";

-- RenameIndex
ALTER INDEX "idx_post_metrics_scheduled_post" RENAME TO "post_metrics_scheduled_post_id_recorded_at_idx";

-- RenameIndex
ALTER INDEX "idx_post_metrics_workspace" RENAME TO "post_metrics_workspace_id_recorded_at_idx";

-- RenameIndex
ALTER INDEX "idx_scheduled_status" RENAME TO "scheduled_posts_status_idx";

-- RenameIndex
ALTER INDEX "idx_scheduled_time" RENAME TO "scheduled_posts_scheduled_at_idx";

-- RenameIndex
ALTER INDEX "idx_scheduled_variant" RENAME TO "scheduled_posts_variant_id_idx";

-- RenameIndex
ALTER INDEX "idx_scheduled_workspace" RENAME TO "scheduled_posts_workspace_id_idx";

-- RenameIndex
ALTER INDEX "idx_social_accounts_platform" RENAME TO "social_accounts_platform_idx";

-- RenameIndex
ALTER INDEX "idx_social_accounts_workspace" RENAME TO "social_accounts_workspace_id_idx";

-- RenameIndex
ALTER INDEX "idx_subscriptions_stripe" RENAME TO "subscriptions_stripe_subscription_id_idx";

-- RenameIndex
ALTER INDEX "idx_subscriptions_workspace" RENAME TO "subscriptions_workspace_id_idx";

-- RenameIndex
ALTER INDEX "idx_users_email" RENAME TO "users_email_idx";

-- RenameIndex
ALTER INDEX "idx_variants_platform" RENAME TO "video_variants_platform_idx";

-- RenameIndex
ALTER INDEX "idx_variants_status" RENAME TO "video_variants_status_idx";

-- RenameIndex
ALTER INDEX "idx_variants_video" RENAME TO "video_variants_video_id_idx";

-- RenameIndex
ALTER INDEX "idx_videos_created" RENAME TO "videos_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_videos_status" RENAME TO "videos_status_idx";

-- RenameIndex
ALTER INDEX "idx_videos_workspace" RENAME TO "videos_workspace_id_idx";

-- RenameIndex
ALTER INDEX "idx_ws_members_user" RENAME TO "workspace_members_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_ws_members_workspace" RENAME TO "workspace_members_workspace_id_idx";

-- RenameIndex
ALTER INDEX "idx_workspaces_owner" RENAME TO "workspaces_owner_id_idx";

-- RenameIndex
ALTER INDEX "idx_workspaces_slug" RENAME TO "workspaces_slug_idx";

