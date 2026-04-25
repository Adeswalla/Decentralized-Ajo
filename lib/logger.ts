/**
 * logger.ts — Universal logger safe for Next.js App Router.
 *
 * - Server (Node.js runtime): Uses Winston with file + console transports.
 * - Browser / Edge Runtime: Falls back to a lightweight console-only shim.
 *
 * IMPORTANT: Never import 'node:fs' or 'node:path' at the module top level.
 *            Webpack cannot handle the "node:" URI scheme when building the
 *            client bundle. All Node-only imports are done inside a guarded
 *            try/require block that Webpack can tree-shake away.
 */

const isBrowser = typeof window !== 'undefined';
const isEdge = typeof EdgeRuntime !== 'undefined' || process.env.NEXT_RUNTIME === 'edge';
const isNodeServer = !isBrowser && !isEdge;

// ── Lightweight shim used in the browser / edge ──────────────────────────────
type LogFn = (...args: unknown[]) => void;

interface LoggerShim {
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  debug: LogFn;
  child: (meta: Record<string, unknown>) => LoggerShim;
}

const consoleShim: LoggerShim = {
  info: (...a) => console.info(...a),
  warn: (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
  debug: (...a) => console.debug(...a),
  child: (_meta) => consoleShim,
};

// ── Full Winston logger (Node.js server only) ─────────────────────────────────
let serverLogger: unknown = null;

function buildServerLogger() {
  if (!isNodeServer) return consoleShim;

  try {
    // Use plain 'fs' / 'path' — Webpack handles these via the fallback map.
    // Do NOT use the 'node:' prefix here; Webpack 5 cannot handle that scheme
    // in client-side (or edge) bundles.
    const fs = require('fs');
    const path = require('path');
    const winston = require('winston');
    const DailyRotateFile = require('winston-daily-rotate-file');

    const isProduction = process.env.NODE_ENV === 'production';
    const logsDir = path.resolve(process.cwd(), 'logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const { combine, timestamp, errors, json, colorize, printf } = winston.format;

    const SENSITIVE_KEYS = new Set([
      'password', 'token', 'jwt', 'authorization',
      'cookie', 'secret', 'apiKey', 'privateKey',
    ]);

    function sanitizeLogValue(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(sanitizeLogValue);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [
            k,
            SENSITIVE_KEYS.has(k) ? '[REDACTED]' : sanitizeLogValue(v),
          ]),
        );
      }
      return value;
    }

    const redactSecrets = winston.format(
      (info: unknown) => sanitizeLogValue(info),
    );

    const devFormat = combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      redactSecrets(),
      printf(({ timestamp: ts, level, message, stack, service, route, module: mod, ...meta }: Record<string, unknown>) => {
        const ctx = [service, route, mod].filter(Boolean).join(' ');
        const payload = stack ? { ...meta, stack } : meta;
        const metaStr = Object.keys(payload).length > 0 ? ` ${JSON.stringify(payload)}` : '';
        return `${ts} [${level}]${ctx ? ` ${ctx}` : ''}: ${message}${metaStr}`;
      }),
    );

    const prodFormat = combine(timestamp(), errors({ stack: true }), redactSecrets(), json());

    const transports: unknown[] = [
      new DailyRotateFile({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d',
        format: prodFormat,
      }),
      new DailyRotateFile({
        filename: path.join(logsDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: prodFormat,
      }),
    ];

    if (!isProduction) {
      transports.push(new winston.transports.Console({ format: devFormat }));
    }

    return winston.createLogger({
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      defaultMeta: { env: process.env.NODE_ENV || 'development', service: 'backend' },
      transports,
      exitOnError: false,
    });
  } catch (e) {
    console.error('[logger] Failed to initialise Winston, falling back to console:', e);
    return consoleShim;
  }
}

// Singleton — built once per process.
if (isNodeServer && !serverLogger) {
  serverLogger = buildServerLogger();
}

export const logger: LoggerShim = (isNodeServer ? serverLogger : consoleShim) as LoggerShim;

export function createChildLogger(meta: Record<string, unknown>): LoggerShim {
  return logger.child(meta);
}

export function createRequestLogger(requestId?: string | null): LoggerShim {
  return logger.child({ requestId: requestId ?? 'unknown' });
}

export default logger;
