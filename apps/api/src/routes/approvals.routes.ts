import { Elysia } from 'elysia';
import {
  ApproveBody,
  CreateApprovalBody,
  IdParam,
  ListApprovalsQuery,
  RejectBody,
} from './schemas';
import { parse, requireAgent, requireOwner, requirePrincipal, type Services } from './context';

export const approvalRoutes = (s: Services) =>
  new Elysia({ prefix: '/v1/approvals' })
    .post('/', async ({ body, headers, set }) => {
      const agent = await requireAgent(s.auth, headers.authorization);
      const input = parse(CreateApprovalBody, body);
      const { approval, created } = await s.approvals.create(agent, input);
      set.status = created ? 201 : 200;
      return approval;
    })
    .get('/', async ({ query, headers }) => {
      const principal = await requirePrincipal(s.auth, headers.authorization);
      const filter = parse(ListApprovalsQuery, query);
      return { approvals: await s.approvals.list(principal, filter) };
    })
    .get('/:id', async ({ params, headers }) => {
      const principal = await requirePrincipal(s.auth, headers.authorization);
      const { id } = parse(IdParam, params);
      return s.approvals.get(principal, id);
    })
    .post('/:id/approve', async ({ params, body, headers }) => {
      const owner = await requireOwner(s.auth, headers.authorization);
      const { id } = parse(IdParam, params);
      const input = parse(ApproveBody, body);
      return s.approvals.approve(owner, id, input.approvalTxHash);
    })
    .post('/:id/reject', async ({ params, body, headers }) => {
      const owner = await requireOwner(s.auth, headers.authorization);
      const { id } = parse(IdParam, params);
      const input = parse(RejectBody, body);
      return s.approvals.reject(owner, id, input.reason || undefined);
    });
