-- Reconcile the API gateway and Prisma data contract for creator growth operations.
-- These changes add observability and intelligence fields without removing existing records.

ALTER TABLE "social_accounts"
  ADD COLUMN IF NOT EXISTS "is_business_account" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "follower_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "video_variants"
  ADD COLUMN IF NOT EXISTS "social_account_id" TEXT;

CREATE INDEX IF NOT EXISTS "video_variants_social_account_id_idx"
  ON "video_variants"("social_account_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_variants_social_account_id_fkey') THEN
    ALTER TABLE "video_variants"
      ADD CONSTRAINT "video_variants_social_account_id_fkey"
      FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "post_metrics"
  ADD COLUMN IF NOT EXISTS "engagement_rate" DECIMAL(8,4),
  ADD COLUMN IF NOT EXISTS "variant_id" TEXT;

CREATE INDEX IF NOT EXISTS "post_metrics_variant_id_idx"
  ON "post_metrics"("variant_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_metrics_scheduled_post_id_fkey') THEN
    ALTER TABLE "post_metrics"
      ADD CONSTRAINT "post_metrics_scheduled_post_id_fkey"
      FOREIGN KEY ("scheduled_post_id") REFERENCES "scheduled_posts"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_metrics_variant_id_fkey') THEN
    ALTER TABLE "post_metrics"
      ADD CONSTRAINT "post_metrics_variant_id_fkey"
      FOREIGN KEY ("variant_id") REFERENCES "video_variants"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "ab_tests"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TYPE "ABTestStatus" ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE "ABTestStatus" ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE "TrendSource" ADD VALUE IF NOT EXISTS 'instagram';

ALTER TABLE "hooks"
  ADD COLUMN IF NOT EXISTS "hook_type" TEXT,
  ADD COLUMN IF NOT EXISTS "hook_text" TEXT,
  ADD COLUMN IF NOT EXISTS "template_used" TEXT,
  ADD COLUMN IF NOT EXISTS "ai_model" TEXT,
  ADD COLUMN IF NOT EXISTS "viral_score" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "hooks_viral_score_idx"
  ON "hooks"("viral_score" DESC);

CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "events" JSONB NOT NULL DEFAULT '[]',
  "secret" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "retry_policy" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "webhooks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "webhooks_workspace_id_idx" ON "webhooks"("workspace_id");
CREATE INDEX IF NOT EXISTS "webhooks_is_active_idx" ON "webhooks"("is_active");

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" TEXT NOT NULL,
  "webhook_id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "response_status" INTEGER NOT NULL DEFAULT 0,
  "response_body" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT FALSE,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_created_at_idx"
  ON "webhook_deliveries"("webhook_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "webhook_deliveries_success_idx" ON "webhook_deliveries"("success");
