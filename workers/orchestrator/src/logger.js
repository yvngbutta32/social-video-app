/**
 * Campaign Orchestrator Logger
 * Structured logging with Pino
 */
import pino from 'pino';
import config from './config.js';

const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.LOG_PRETTY ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    service: 'orchestrator',
    version: '1.0.0',
  },
});

export default logger;