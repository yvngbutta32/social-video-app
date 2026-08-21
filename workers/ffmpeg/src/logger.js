/**
 * Structured logging with Pino
 * Supports pretty printing in development, JSON in production
 */

import pino from 'pino';
import { config } from './config.js';

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: config.LOG_LEVEL,
  transport: isDevelopment && config.LOG_PRETTY
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'ffmpeg-worker',
    version: process.env.npm_package_version || '1.0.0',
  },
});

export { logger };

export function createChildLogger(bindings) {
  return logger.child(bindings);
}

export default logger;