import pino from 'pino';
import { config } from './config.js';

const transport = config.env === 'development' 
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino({
  level: config.env === 'development' ? 'debug' : 'info',
  transport,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'processor-worker',
    env: config.env,
  },
});

export function createChildLogger(context) {
  return logger.child(context);
}