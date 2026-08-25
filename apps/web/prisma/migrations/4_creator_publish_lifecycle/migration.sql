-- Persist creator-controlled publishing lifecycle and recovery records without changing existing post ownership.

ALTER TABLE "scheduled_posts"
  ADD COLUMN IF NOT EXISTS "creator_approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "creator_approved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "last_attempt_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "next_attempt_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dead_lettered_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_posts_workspace_id_idempotency_key_key"
  ON "scheduled_posts"("workspace_id", "idempotency_key");

DO $$ BEGIN
  CREATE TYPE "PublishAttemptStatus" AS ENUM (
    'queued', 'attempting', 'succeeded', 'retry_scheduled', 'dead_lettered', 'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "publishing_attempts" (
  "id" TEXT NOT NULL,
  "scheduled_post_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "status" "PublishAttemptStatus" NOT NULL DEFAULT 'queued',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "next_attempt_at" TIMESTAMP(3),
  "response_status" INTEGER,
  "error_code" TEXT,
  "error_message" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "publishing_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "publishing_attempts_scheduled_post_id_fkey"
    FOREIGN KEY ("scheduled_post_id") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "publishing_attempts_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "publishing_attempts_scheduled_post_id_attempt_number_key" UNIQUE ("scheduled_post_id", "attempt_number"),
  CONSTRAINT "publishing_attempts_workspace_id_idempotency_key_key" UNIQUE ("workspace_id", "idempotency_key")
);

CREATE INDEX IF NOT EXISTS "publishing_attempts_workspace_id_status_requested_at_idx"
  ON "publishing_attempts"("workspace_id", "status", "requested_at" DESC);
CREATE INDEX IF NOT EXISTS "publishing_attempts_scheduled_post_id_requested_at_idx"
  ON "publishing_attempts"("scheduled_post_id", "requested_at" DESC);
