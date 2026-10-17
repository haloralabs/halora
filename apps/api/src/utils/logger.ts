/**
 * Minimal structured JSON logger.
 *
 * Every field passes through `redact` before it is written. Keys that can carry credentials
 * (secrets, API keys, tokens, signatures, signed XDR) are replaced, and any value that looks like
 * a Stellar secret seed is masked wherever it appears. Never log request headers or bodies.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /secret|password|authorization|api[-_]?key|token|signature|seed|xdr|cookie/i;
const STELLAR_SEED = /S[A-Z2-7]{55}/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
// Drizzle query errors append bound parameters (token hashes, key hashes) to the message.
const QUERY_PARAMS = /\nparams: [\s\S]*$/;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (typeof value === 'string') {
    return value
      .replace(QUERY_PARAMS, '\nparams: [redacted]')
      .replace(STELLAR_SEED, '[redacted-seed]')
      .replace(BEARER, 'Bearer [redacted]');
  }
  if (value instanceof Error) {
    return { name: value.name, message: redact(value.message, depth + 1) };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export type Logger = {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
};

export function createLogger(minLevel: LogLevel = 'info', sink = console.log): Logger {
  const write = (level: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (LEVELS[level] < LEVELS[minLevel]) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      msg: redact(msg),
      ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
    };
    sink(JSON.stringify(entry));
  };
  return {
    debug: (m, f) => write('debug', m, f),
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
  };
}

export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
