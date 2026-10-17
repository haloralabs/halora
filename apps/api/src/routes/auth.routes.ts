import { Elysia } from 'elysia';
import { ChallengeBody, VerifyBody } from './schemas';
import { parse, type Services } from './context';

export const authRoutes = (s: Services) =>
  new Elysia({ prefix: '/v1/auth' })
    .post('/challenge', async ({ body }) => {
      const input = parse(ChallengeBody, body);
      return s.auth.createChallenge(input.publicKey);
    })
    .post('/verify', async ({ body }) => {
      const input = parse(VerifyBody, body);
      return s.auth.verifyChallenge(input);
    });
