import winston from 'winston';
import { config } from '../config/environment';

// Custom replacer to handle circular references
const seen = new WeakSet();
const replacer = (key: string, value: any) => {
  if (typeof value === 'object' && value !== null) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
  }
  return value;
};

// Filter disabled for now - using log level instead
// const httpOnlyFilter = winston.format((info) => info)();

// Enhanced development format - more readable and detailed
const devFormat = winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0
    ? '\n' + JSON.stringify(meta, replacer, 2)
    : '';

  const corrId = correlationId ? ` [${correlationId}]` : '';
  return `${timestamp} [${level}]${corrId} ${message}${metaStr}`;
});

// JSON format for production
const jsonFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...meta,
  }, replacer);
});

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  config.server.isDevelopment
    ? winston.format.combine(
        winston.format.colorize(),
        devFormat
      )
    : winston.format.combine(
        winston.format.json(),
        jsonFormat
      )
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.server.isDevelopment ? 'silent' : config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: 'ebeautything-backend',
    environment: config.server.env,
  },
  transports: [
    // Console transport - always enabled
    new winston.transports.Console({
      format: logFormat,
      silent: config.server.isDevelopment, // Silent in dev to show only HTTP requests via console.log
    }),
    // File transport for production
    ...(config.server.isProduction
      ? [
          new winston.transports.File({
            filename: `${config.logging.filePath}/error.log`,
            level: 'error',
            maxsize: 20971520, // 20MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: `${config.logging.filePath}/combined.log`,
            maxsize: 20971520, // 20MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

// Add request ID context
export const addRequestId = (requestId: string) => {
  return logger.child({ requestId });
};

export default logger; 