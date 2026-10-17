import { createApp } from './app';
import { loadEnv, resolveRpcUrl } from './config/env';
import { createDatabase } from './db/client';
import { createDrizzleRepositories } from './repositories/drizzle';
import { RpcChainReader } from './stellar/chain';
import { networkPassphrase } from './stellar/network';
import { createLogger } from './utils/logger';
import { ExpiryWorker } from './workers/expiry';
import { PaymentIndexer } from './workers/payment-indexer';
import { every } from './workers/scheduler';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const { db, close } = createDatabase(env.DATABASE_URL);
const repos = createDrizzleRepositories(db);
const chain = new RpcChainReader(resolveRpcUrl(env), networkPassphrase(env.HALORA_NETWORK));

const app = createApp({
  config: {
    network: env.HALORA_NETWORK,
    authDomain: env.AUTH_DOMAIN,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    sessionTtlSeconds: env.SESSION_TTL_SECONDS,
    challengeTtlSeconds: env.CHALLENGE_TTL_SECONDS,
    approvalDefaultTtlSeconds: env.APPROVAL_DEFAULT_TTL_SECONDS,
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
    trustProxy: env.TRUST_PROXY,
  },
  repos,
  chain,
  logger,
}).listen(env.PORT);

const stops: Array<() => void> = [];
const expiry = new ExpiryWorker(repos, logger);
stops.push(every('expiry', env.EXPIRY_INTERVAL_MS, () => expiry.tick(), logger));
if (env.INDEXER_ENABLED) {
  const indexer = new PaymentIndexer(repos, chain, logger, { network: env.HALORA_NETWORK });
  stops.push(every('payment-indexer', env.INDEXER_INTERVAL_MS, () => indexer.tick(), logger));
}

logger.info('halora api listening', { port: env.PORT, network: env.HALORA_NETWORK });

const shutdown = async () => {
  logger.info('shutting down');
  for (const stop of stops) stop();
  await app.stop();
  await close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
