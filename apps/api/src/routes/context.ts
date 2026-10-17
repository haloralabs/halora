import type { z } from 'zod';
import type { Principal } from '../domain';
import type { AccountService } from '../services/account.service';
import type { ApprovalService } from '../services/approval.service';
import type { AuthService } from '../services/auth.service';
import { forbidden, fromZodError, unauthorized } from '../utils/errors';

export type Services = {
  auth: AuthService;
  accounts: AccountService;
  approvals: ApprovalService;
};

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input ?? {});
  if (!result.success) throw fromZodError(result.error);
  return result.data;
}

export async function requirePrincipal(
  auth: AuthService,
  authorization: string | undefined,
): Promise<Principal> {
  const principal = await auth.authenticate(authorization);
  if (!principal) throw unauthorized();
  return principal;
}

export async function requireOwner(
  auth: AuthService,
  authorization: string | undefined,
): Promise<Extract<Principal, { kind: 'owner' }>> {
  const principal = await requirePrincipal(auth, authorization);
  if (principal.kind !== 'owner') throw forbidden('This route requires an owner session');
  return principal;
}

export async function requireAgent(
  auth: AuthService,
  authorization: string | undefined,
): Promise<Extract<Principal, { kind: 'agent' }>> {
  const principal = await requirePrincipal(auth, authorization);
  if (principal.kind !== 'agent') throw forbidden('This route requires an agent API key');
  return principal;
}
