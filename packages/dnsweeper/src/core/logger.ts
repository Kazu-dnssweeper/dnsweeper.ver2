import pino from 'pino';

// Simple logger instance used across the project
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export default logger;
export { logger };
