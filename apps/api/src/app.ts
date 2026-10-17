import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { RateLimiter } from './middleware/rate-limit';
import type { Repositories } from './repositories/types';
import { accountRoutes } from './routes/accounts.routes';
import { approvalRoutes } from './routes/approvals.routes';
import { authRoutes } from './routes/auth.routes';
import type { Services } from './routes/context';
import { AccountService } from './services/account.service';
import { ApprovalService } from './services/approval.service';
import { AuthService } from './services/auth.service';
import type { ChainReader } from './stellar/chain';
import { ApiError, toErrorBody } from './utils/errors';
import type { Logger } from './utils/logger';

export type AppConfig = {
  network: 'testnet' | 'mainnet';
  authDomain: string;
  corsOrigins: string[];
  sessionTtlSeconds: number;
  challengeTtlSeconds: number;
  approvalDefaultTtlSeconds: number;
  rateLimitPerMinute: number;
  trustProxy: boolean;
};

export type AppDeps = {
  config: AppConfig;
  repos: Repositories;
  chain: ChainReader;
  logger: Logger;
  now?: () => Date;
};

export function createServices(deps: AppDeps): Services {
  const now = deps.now ?? (() => new Date());
  const { config, repos, logger } = deps;
  const auth = new AuthService(repos, {
    domain: config.authDomain,
    challengeTtlSeconds: config.challengeTtlSeconds,
    sessionTtlSeconds: config.sessionTtlSeconds,
    now,
  });
  const accounts = new AccountService(repos, deps.chain, config.network, logger, now);
  const approvals = new ApprovalService(repos, accounts, deps.chain, logger, {
    defaultTtlSeconds: config.approvalDefaultTtlSeconds,
    now,
  });
  return { auth, accounts, approvals };
}

export function createApp(deps: AppDeps) {
  const { config, logger } = deps;
  const services = createServices(deps);
  const generalLimiter = new RateLimiter(config.rateLimitPerMinute);
  // Login endpoints get a tighter budget to slow down challenge flooding.
  const authLimiter = new RateLimiter(Math.max(5, Math.floor(config.rateLimitPerMinute / 6)));
  const startedAt = new WeakMap<Request, number>();

  const clientKey = (request: Request, ip: string | undefined) => {
    if (config.trustProxy) {
      const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      if (fwd) return fwd;
    }
    return ip ?? 'unknown';
  };

  return new Elysia()
    .use(
      cors({
        origin: config.corsOrigins,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: false,
      }),
    )
    .onRequest(({ request, server, set }) => {
      startedAt.set(request, performance.now());
      const path = new URL(request.url).pathname;
      if (request.method === 'OPTIONS' || path === '/health') return;
      const limiter = path.startsWith('/v1/auth/') ? authLimiter : generalLimiter;
      const scope = path.startsWith('/v1/auth/') ? 'auth' : 'api';
      const result = limiter.hit(
        `${scope}:${clientKey(request, server?.requestIP(request)?.address)}`,
      );
      if (!result.allowed) {
        set.status = 429;
        set.headers['retry-after'] = String(result.retryAfter);
        return toErrorBody(new ApiError(429, 'rate_limited', 'Too many requests'));
      }
    })
    .onAfterResponse(({ request, set }) => {
      const start = startedAt.get(request);
      // Path only: query strings and headers are never logged.
      logger.info('request', {
        method: request.method,
        path: new URL(request.url).pathname,
        status: typeof set.status === 'number' ? set.status : 200,
        ms: start === undefined ? undefined : Math.round(performance.now() - start),
      });
    })
    .onError(({ code, error, set }) => {
      if (error instanceof ApiError) {
        set.status = error.status;
        return toErrorBody(error);
      }
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return toErrorBody(new ApiError(404, 'not_found', 'Route not found'));
      }
      if (code === 'PARSE' || code === 'VALIDATION') {
        set.status = 400;
        return toErrorBody(new ApiError(400, 'validation_error', 'Malformed request'));
      }
      logger.error('unhandled error', { code: String(code), err: error });
      set.status = 500;
      return toErrorBody(new ApiError(500, 'internal_error', 'Internal server error'));
    })
    .get('/health', () => ({ status: 'ok' }))
    .use(authRoutes(services))
    .use(accountRoutes(services))
    .use(approvalRoutes(services));
}

export type App = ReturnType<typeof createApp>;
