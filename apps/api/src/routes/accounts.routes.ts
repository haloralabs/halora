import { Elysia } from 'elysia';
import { ContractIdParam, PaymentsQuery, RegisterAccountBody } from './schemas';
import { parse, requireOwner, requirePrincipal, type Services } from './context';

export const accountRoutes = (s: Services) =>
  new Elysia({ prefix: '/v1/accounts' })
    .post('/', async ({ body, headers, set }) => {
      const owner = await requireOwner(s.auth, headers.authorization);
      const input = parse(RegisterAccountBody, body);
      const result = await s.accounts.register(owner.publicKey, input);
      set.status = 201;
      set.headers['cache-control'] = 'no-store';
      return result;
    })
    .get('/', async ({ headers }) => {
      const owner = await requireOwner(s.auth, headers.authorization);
      return { accounts: await s.accounts.list(owner.publicKey) };
    })
    .get('/:contractId/payments', async ({ params, query, headers }) => {
      // Owner, or the account's own agent (so the MCP server can list recent payments).
      const principal = await requirePrincipal(s.auth, headers.authorization);
      const { contractId } = parse(ContractIdParam, params);
      const { limit } = parse(PaymentsQuery, query);
      return { payments: await s.accounts.payments(principal, contractId, limit) };
    });
