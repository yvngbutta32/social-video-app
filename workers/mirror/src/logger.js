import pino from 'pino';
import config from './config.js';

const logger = pino({
  level: config.LOG_LEVEL,
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' }
  } : undefined,
  base: {
    service: config.WORKER_NAME,
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'localhost',
  },
});

export default logger;
export { logger };