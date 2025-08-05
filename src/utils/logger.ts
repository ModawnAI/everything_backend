import winston from 'winston';
import { config } from '../config/environment';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: 'ebeautything-backend',
    environment: config.server.env,
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: config.server.isDevelopment
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : logFormat,
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