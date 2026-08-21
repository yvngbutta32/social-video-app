/**
 * Health check endpoint for FFmpeg worker
 * Used by Docker healthcheck and load balancers
 */

import { config } from './config.js';
import { createConnection } from 'amqplib';
import pg from 'pg';
import { Client } from 'minio';
import { createClient } from 'redis';

const { Pool } = pg;

async function checkDatabase() {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    return { status: 'healthy', service: 'postgresql' };
  } catch (err) {
    await pool.end().catch(() => {});
    return { status: 'unhealthy', service: 'postgresql', error: err.message };
  }
}

async function checkRabbitMQ() {
  try {
    const conn = await createConnection(config.RABBITMQ_URL);
    await conn.close();
    return { status: 'healthy', service: 'rabbitmq' };
  } catch (err) {
    return { status: 'unhealthy', service: 'rabbitmq', error: err.message };
  }
}

async function checkMinIO() {
  try {
    const client = new Client({
      endPoint: config.MINIO_ENDPOINT.split(':')[0],
      port: parseInt(config.MINIO_ENDPOINT.split(':')[1] || '9000'),
      useSSL: config.MINIO_USE_SSL,
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
    });

    await client.bucketExists(config.MINIO_BUCKET_VIDEOS);
    return { status: 'healthy', service: 'minio' };
  } catch (err) {
    return { status: 'unhealthy', service: 'minio', error: err.message };
  }
}

async function checkRedis() {
  try {
    const client = createClient({ url: config.REDIS_URL });
    await client.connect();
    await client.ping();
    await client.quit();
    return { status: 'healthy', service: 'redis' };
  } catch (err) {
    return { status: 'unhealthy', service: 'redis', error: err.message };
  }
}

async function checkFFmpeg() {
  try {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      const proc = spawn('ffmpeg', ['-version']);
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ status: 'healthy', service: 'ffmpeg' });
        } else {
          resolve({ status: 'unhealthy', service: 'ffmpeg', error: `Exit code ${code}` });
        }
      });
      proc.on('error', (err) => {
        resolve({ status: 'unhealthy', service: 'ffmpeg', error: err.message });
      });
      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve({ status: 'unhealthy', service: 'ffmpeg', error: 'Timeout' });
      }, 5000);
    });
  } catch (err) {
    return { status: 'unhealthy', service: 'ffmpeg', error: err.message };
  }
}

async function checkDiskSpace() {
  try {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      const proc = spawn('df', ['-h', '/tmp']);
      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.on('close', (code) => {
        if (code === 0) {
          const lines = output.trim().split('\n');
          if (lines.length > 1) {
            const parts = lines[1].split(/\s+/);
            const usePercent = parseInt(parts[4].replace('%', ''));
            if (usePercent > 90) {
              resolve({ status: 'degraded', service: 'disk', usage: `${usePercent}%`, message: 'Disk space critical' });
            } else if (usePercent > 80) {
              resolve({ status: 'degraded', service: 'disk', usage: `${usePercent}%`, message: 'Disk space warning' });
            } else {
              resolve({ status: 'healthy', service: 'disk', usage: `${usePercent}%` });
            }
          } else {
            resolve({ status: 'healthy', service: 'disk' });
          }
        } else {
          resolve({ status: 'unknown', service: 'disk' });
        }
      });
    });
  } catch (err) {
    return { status: 'unknown', service: 'disk', error: err.message };
  }
}

async function runHealthChecks() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRabbitMQ(),
    checkMinIO(),
    checkRedis(),
    checkFFmpeg(),
    checkDiskSpace(),
  ]);

  const results = checks.map((check, index) => {
    const services = ['postgresql', 'rabbitmq', 'minio', 'redis', 'ffmpeg', 'disk'];
    if (check.status === 'fulfilled') {
      return check.value;
    } else {
      return { status: 'unhealthy', service: services[index], error: check.reason?.message };
    }
  });

  const unhealthy = results.filter(r => r.status === 'unhealthy');
  const degraded = results.filter(r => r.status === 'degraded');

  let overallStatus = 'healthy';
  if (unhealthy.length > 0) {
    overallStatus = 'unhealthy';
  } else if (degraded.length > 0) {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: 'ffmpeg-worker',
    version: process.env.npm_package_version || '1.0.0',
    checks: results,
  };
}

// CLI usage
async function main() {
  const result = await runHealthChecks();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'healthy' ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({
    status: 'unhealthy',
    timestamp: new Date().toISOString(),
    service: 'ffmpeg-worker',
    error: err.message,
  }, null, 2));
  process.exit(1);
});

export { runHealthChecks };
export default runHealthChecks;