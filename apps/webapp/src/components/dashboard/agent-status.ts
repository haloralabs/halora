import type { BadgeTone } from '@/components/ui';
import type { Policy } from '@/lib/domain';

export type AgentStatus = { label: 'Active' | 'Paused' | 'Expired'; tone: BadgeTone };

/** Paused wins over expired: both block the agent, but pause is the owner's explicit action. */
export function agentStatus(policy: Policy, now: number = Date.now()): AgentStatus {
  if (policy.paused) return { label: 'Paused', tone: 'warning' };
  if (policy.expiresAt > 0 && policy.expiresAt * 1000 <= now)
    return { label: 'Expired', tone: 'danger' };
  return { label: 'Active', tone: 'success' };
}
