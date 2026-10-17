const STELLAR_SEED = /S[A-Z2-7]{55}/g;
const API_KEY = /hak_[A-Za-z0-9_-]+/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

/**
 * Removes anything that looks like key material from text that is about to leave the server
 * (tool results, error messages, logs). `extra` holds exact values to scrub, such as the
 * configured agent secret and API key, in case an upstream error echoes them.
 */
export function scrub(text: string, extra: string[] = []): string {
  let out = text;
  for (const value of extra) {
    if (value && value.length >= 8) out = out.split(value).join('[redacted]');
  }
  return out
    .replace(STELLAR_SEED, '[redacted]')
    .replace(API_KEY, '[redacted]')
    .replace(BEARER, 'Bearer [redacted]');
}
