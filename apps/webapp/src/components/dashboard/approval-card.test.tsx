import { describe, expect, mock, test } from 'bun:test';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { fireEvent, render, screen, waitFor } from '@/test/render';
import type { ApprovalRequest } from '@/lib/domain';
import { ApprovalCard } from './approval-card';

const NOW = Date.parse('2026-10-16T12:00:00Z');

const approval: ApprovalRequest = {
  id: 'apr_1',
  contractId: StrKey.encodeContract(Buffer.alloc(32, 1)),
  token: StrKey.encodeContract(Buffer.alloc(32, 2)),
  to: Keypair.random().publicKey(),
  amount: '2400000000',
  reason: 'Annual license renewal',
  status: 'pending',
  createdAt: new Date(NOW - 600_000).toISOString(),
  expiresAt: new Date(NOW + 3_600_000).toISOString(),
};

describe('ApprovalCard', () => {
  test('shows amount and reason, and approves with a 15 minute on-chain approval by default', async () => {
    const onApprove = mock(async (_expiresAt: number) => {});
    render(
      <ApprovalCard
        approval={approval}
        agentLabel="Procurement agent"
        onApprove={onApprove}
        onReject={async () => {}}
        now={NOW}
      />,
    );
    expect(screen.getByText('240.00')).toBeDefined();
    expect(screen.getByText('Annual license renewal')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /approve and sign/i }));
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith(NOW / 1000 + 15 * 60));
  });

  test('honors a longer approval window', async () => {
    const onApprove = mock(async (_expiresAt: number) => {});
    render(
      <ApprovalCard
        approval={approval}
        agentLabel="Agent"
        onApprove={onApprove}
        onReject={async () => {}}
        now={NOW}
      />,
    );
    fireEvent.change(screen.getByLabelText('Approval valid for'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /approve and sign/i }));
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith(NOW / 1000 + 3600));
  });

  test('rejects with an optional reason', async () => {
    const onReject = mock(async (_reason?: string) => {});
    render(
      <ApprovalCard
        approval={approval}
        agentLabel="Agent"
        onApprove={async () => {}}
        onReject={onReject}
        now={NOW}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.change(screen.getByLabelText(/reason for rejecting/i), {
      target: { value: 'Too expensive' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reject request/i }));
    await waitFor(() => expect(onReject).toHaveBeenCalledWith('Too expensive'));
  });

  test('warns when the payment would exceed the daily limit and surfaces errors', async () => {
    render(
      <ApprovalCard
        approval={approval}
        agentLabel="Agent"
        limits={{ spentToday: '14000000000', dailyLimit: '15000000000', paused: false }}
        onApprove={async () => {
          throw new Error('Wallet declined');
        }}
        onReject={async () => {}}
        now={NOW}
      />,
    );
    expect(screen.getByText(/exceed today's limit/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /approve and sign/i }));
    expect(await screen.findByText('Wallet declined')).toBeDefined();
  });

  test('shows no actions once decided', () => {
    render(
      <ApprovalCard
        approval={{ ...approval, status: 'rejected' }}
        agentLabel="Agent"
        onApprove={async () => {}}
        onReject={async () => {}}
        now={NOW}
      />,
    );
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.getByText('Rejected')).toBeDefined();
  });
});
