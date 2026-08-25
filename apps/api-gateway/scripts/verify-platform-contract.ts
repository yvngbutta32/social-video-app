import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function main() {
  const schemaPath = new URL('../../web/prisma/schema.prisma', import.meta.url);
  const migrationPath = new URL('../../web/prisma/migrations/3_platform_contract_reconciliation/migration.sql', import.meta.url);
  const [schema, migration] = await Promise.all([
    readFile(schemaPath, 'utf8'),
    readFile(migrationPath, 'utf8'),
  ]);

  for (const expectedSchemaFragment of [
    'isBusinessAccount',
    'followerCount',
    'socialAccountId',
    'engagementRate',
    'model Webhook {',
    'model WebhookDelivery {',
    'hookType',
    'viralScore',
    'enum ABTestStatus {\n  draft',
    'paused',
    'instagram',
  ]) {
    assert(schema.includes(expectedSchemaFragment), `Missing schema contract: ${expectedSchemaFragment}`);
  }

  for (const expectedMigrationFragment of [
    'is_business_account',
    'follower_count',
    'engagement_rate',
    'variant_id',
    'CREATE TABLE IF NOT EXISTS "webhooks"',
    'CREATE TABLE IF NOT EXISTS "webhook_deliveries"',
    'ALTER TYPE "ABTestStatus" ADD VALUE IF NOT EXISTS \'draft\'',
    'ALTER TYPE "TrendSource" ADD VALUE IF NOT EXISTS \'instagram\'',
  ]) {
    assert(migration.includes(expectedMigrationFragment), `Missing migration contract: ${expectedMigrationFragment}`);
  }

  console.log('Platform data-contract verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
