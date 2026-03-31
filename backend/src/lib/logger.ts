import pino from 'pino';
import pinoHttp from 'pino-http';

export const logger = pino({
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino/file', options: { destination: 1 } }
    : undefined,
  level: process.env.LOG_LEVEL || 'info',
});

export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/api/health',
  },
});
