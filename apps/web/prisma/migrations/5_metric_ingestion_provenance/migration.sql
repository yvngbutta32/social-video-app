-- Add connector-ingestion provenance without altering existing metric snapshots.
ALTER TABLE post_metrics
  ADD COLUMN IF NOT EXISTS ingestion_key TEXT,
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS uq_post_metrics_ingestion
  ON post_metrics (scheduled_post_id, ingestion_key)
  WHERE ingestion_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_metrics_imported_at
  ON post_metrics (workspace_id, imported_at DESC)
  WHERE imported_at IS NOT NULL;
