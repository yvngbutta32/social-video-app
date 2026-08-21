import pino, { pino as pinoFactory } from 'pino';
import { Logger, LoggerOptions } from 'pino';
import { getConfig } from './config.js';

const config = getConfig();

const loggerOptions: LoggerOptions = {
  level: config.LOG_LEVEL,
  base: {
    service: 'delivery-worker',
  },
};

if (config.LOG_PRETTY) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

const pinoLogger: Logger = pinoFactory(loggerOptions);
export const logger = pinoLogger;

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
