import type { Repositories } from '../repositories/types';
import type { Logger } from '../utils/logger';

/** Expires stale pending approvals and purges expired challenges and sessions. */
export class ExpiryWorker {
  constructor(
    private readonly repos: Repositories,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async tick(): Promise<{ approvals: number; challenges: number; sessions: number }> {
    const now = this.now();
    const [approvals, challenges, sessions] = await Promise.all([
      this.repos.approvals.expirePending(now),
      this.repos.challenges.deleteExpired(now),
      this.repos.sessions.deleteExpired(now),
    ]);
    if (approvals > 0) this.logger.info('approvals expired', { count: approvals });
    return { approvals, challenges, sessions };
  }
}
