import { access } from 'fs/promises';
import net from 'net';
import { spawn } from 'child_process';

function checkTcp(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function runCommand(command, args = [], timeoutMs = 2500) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(false);
    }, timeoutMs);
    child.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

export function buildConfigurationChecks(env = process.env) {
  return {
    dbPassword: Boolean(env.DB_PASSWORD),
    minioAccessKey: Boolean(env.MINIO_ACCESS_KEY),
    minioSecretKey: Boolean(env.MINIO_SECRET_KEY),
    encryptionKey: typeof env.ENCRYPTION_KEY === 'string' && env.ENCRYPTION_KEY.length === 32,
  };
}

export async function runStagingPreflight(env = process.env) {
  const dbHost = env.DB_HOST || 'localhost';
  const dbPort = Number(env.DB_PORT || 5432);
  const redisUrl = new URL(env.REDIS_URL || 'redis://localhost:6379');
  const minioHost = env.MINIO_ENDPOINT || 'localhost';
  const minioPort = Number(env.MINIO_PORT || 9000);
  const whisperPath = env.WHISPER_PATH || '/usr/local/bin/whisper';
  const whisperModel = env.WHISPER_MODEL || '/models/ggml-base.en.bin';
  const checks = {
    configuration: buildConfigurationChecks(env),
    services: {
      postgres: await checkTcp(dbHost, dbPort),
      redis: await checkTcp(redisUrl.hostname, Number(redisUrl.port || 6379)),
      minio: await checkTcp(minioHost, minioPort),
    },
    tools: {
      ffmpeg: await runCommand('ffmpeg', ['-version']),
      ffprobe: await runCommand('ffprobe', ['-version']),
      python: await runCommand('python3', ['--version']),
      sceneDetect: await runCommand('python3', ['-c', 'import scenedetect']),
      whisper: await access(whisperPath).then(() => true, () => false),
      whisperModel: await access(whisperModel).then(() => true, () => false),
    },
  };
  const flat = [
    ...Object.values(checks.configuration),
    ...Object.values(checks.services),
    ...Object.values(checks.tools),
  ];
  return { healthy: flat.every(Boolean), checks };
}
