/**
 * Logger Utility
 * Provides structured logging for agent execution
 */

import winston from 'winston';
import path from 'path';

const logLevel = process.env.AGENT_LOG_LEVEL || 'info';

// Create logs directory
const logsDir = path.join(process.cwd(), 'reports', 'logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat
    }),
    // File output - all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'agent-all.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // File output - errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'agent-error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Create a child logger for specific module
export function createModuleLogger(module: string) {
  return logger.child({ module });
}
