import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'password', 'token', 'jwt', 'authorization',
      '*.password', '*.token', '*.jwt', '*.authorization',
      '**.*.password', '**.*.token', '**.*.jwt', '**.*.authorization',
      'headers.authorization', 'req.headers.authorization',
      'user.password', 'user.token', 'user.jwt'
    ],
    remove: true,
  },
  base: {
    env: process.env.NODE_ENV,
    revision: process.env.VERCEL_GITHUB_COMMIT_SHA,
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  transport: (isProduction || process.env.NEXT_RUNTIME === 'edge') ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
    },
  },
});

// Global error handlers
if (typeof window === 'undefined') {
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught Exception');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection');
  });
}
