import type { Logger } from '../utils/logger';

/**
 * Runs `task` every `intervalMs`, never overlapping with itself. Returns a stop function.
 * Errors are logged and the loop continues.
 */
export function every(
  name: string,
  intervalMs: number,
  task: () => Promise<unknown>,
  logger: Logger,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    try {
      await task();
    } catch (err) {
      logger.error('worker tick failed', { worker: name, err });
    }
    if (!stopped) timer = setTimeout(run, intervalMs);
  };
  timer = setTimeout(run, 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
