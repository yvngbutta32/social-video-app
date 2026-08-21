import pg from 'pg';
import config from './config.js';
import logger from './logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug({ query: text.substring(0, 100), duration, rows: res.rowCount }, 'Executed query');
  return res;
}

export async function getClient() {
  return pool.connect();
}

export async function closePool() {
  await pool.end();
}

// Mirror-specific database operations
export async function createMirrorRecord(data) {
  const { videoId, creatorId, creatorProfileId, originalS3Key, mirrorS3Key, mirrorBucket, encryptionKeyId, fileSizeBytes, checksum, metadata } = data;
  const result = await query(
    `INSERT INTO content_mirrors (video_id, creator_id, creator_profile_id, original_s3_key, mirror_s3_key, mirror_bucket, encryption_key_id, file_size_bytes, checksum, metadata, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed')
     RETURNING *`,
    [videoId, creatorId, creatorProfileId, originalS3Key, mirrorS3Key, mirrorBucket, encryptionKeyId, fileSizeBytes, checksum, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function getMirrorRecord(mirrorId) {
  const result = await query('SELECT * FROM content_mirrors WHERE id = $1', [mirrorId]);
  return result.rows[0];
}

export async function getMirrorsByCreator(creatorId, limit = 50, offset = 0) {
  const result = await query(
    `SELECT cm.*, v.title, v.status as video_status, v.created_at as video_created_at
     FROM content_mirrors cm
     JOIN videos v ON cm.video_id = v.id
     WHERE cm.creator_id = $1
     ORDER BY cm.created_at DESC
     LIMIT $2 OFFSET $3`,
    [creatorId, limit, offset]
  );
  return result.rows;
}

export async function getMirrorsByVideo(videoId) {
  const result = await query('SELECT * FROM content_mirrors WHERE video_id = $1 ORDER BY created_at DESC', [videoId]);
  return result.rows;
}

export async function updateMirrorStatus(mirrorId, status, errorMessage = null) {
  const result = await query(
    `UPDATE content_mirrors SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
    [status, errorMessage, mirrorId]
  );
  return result.rows[0];
}

export async function getCreatorProfileByUserId(userId) {
  const result = await query('SELECT * FROM creator_profiles WHERE user_id = $1', [userId]);
  return result.rows[0];
}

export async function getCreatorProfileById(profileId) {
  const result = await query('SELECT * FROM creator_profiles WHERE id = $1', [profileId]);
  return result.rows[0];
}

export async function getVideoById(videoId) {
  const result = await query('SELECT * FROM videos WHERE id = $1', [videoId]);
  return result.rows[0];
}

export async function getInviteCodeByCode(code) {
  const result = await query('SELECT * FROM invite_codes WHERE code = $1', [code]);
  return result.rows[0];
}

export { pool };