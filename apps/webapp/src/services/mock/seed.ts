import { StrKey } from '@stellar/stellar-sdk';
import type {
  AgentAccount,
  ApprovalRequest,
  PaymentRecord,
  Policy,
  PreApproval,
} from '@/lib/domain';
import { toBaseUnits } from '@/lib/money';

/**
 * Deterministic seed data for mock mode. Addresses are real, checksummed strkeys derived from a
 * seeded PRNG, so every validator in the app accepts them. None of them hold funds anywhere.
 */

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bytes(rand: () => number, n: number): Buffer {
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor(rand() * 256);
  return out;
}

export function makeKeyFactory(seed: number) {
  const rand = prng(seed);
  return {
    account: () => StrKey.encodeEd25519PublicKey(bytes(rand, 32)),
    contract: () => StrKey.encodeContract(bytes(rand, 32)),
    hex: (n: number) => bytes(rand, n).toString('hex'),
    base64: (n: number) => bytes(rand, n).toString('base64'),
    pick: <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T,
    float: rand,
  };
}

export type SeedState = {
  accounts: AgentAccount[];
  policies: Map<string, Policy>;
  balances: Map<string, string>;
  payments: PaymentRecord[];
  approvals: ApprovalRequest[];
  apiKeys: Map<string, string>;
  /** contractId to recipient to active pre-approval. */
  preApprovals: Map<string, Map<string, PreApproval>>;
  ownerPublicKey: string;
  usdc: string;
};

const u = (amount: string) => toBaseUnits(amount);

const RESOURCES = [
  'https://api.weatherlayer.dev/v2/forecast?lat=52.52&lon=13.40',
  'https://data.openmarkets.io/quotes/XLM-USDC',
  'https://search.paperlens.ai/v1/query',
  'https://api.geocodr.net/reverse?q=40.71,-74.00',
  'https://inference.tinyllm.run/v1/embeddings',
  'https://news.wirefeed.io/v1/headlines?topic=energy',
];

export function createSeed(now: number = Date.now()): SeedState {
  const keys = makeKeyFactory(20261016);
  const ownerPublicKey = keys.account();
  const usdc = keys.contract();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const research: AgentAccount = {
    contractId: keys.contract(),
    ownerPublicKey,
    agentPublicKey: keys.account(),
    label: 'Research assistant',
    network: 'testnet',
    createdAt: iso(19 * day),
  };
  const procurement: AgentAccount = {
    contractId: keys.contract(),
    ownerPublicKey,
    agentPublicKey: keys.account(),
    label: 'Procurement agent',
    network: 'testnet',
    createdAt: iso(41 * day),
  };
  const monitor: AgentAccount = {
    contractId: keys.contract(),
    ownerPublicKey,
    agentPublicKey: keys.account(),
    label: 'Infra cost monitor',
    network: 'testnet',
    createdAt: iso(6 * day),
  };

  const vendors = [keys.account(), keys.account(), keys.account()];

  const policies = new Map<string, Policy>([
    [
      research.contractId,
      {
        token: usdc,
        perTxLimit: u('5'),
        dailyLimit: u('25'),
        approvalThreshold: u('2'),
        allowlistEnabled: false,
        allowlist: [],
        expiresAt: Math.floor((now + 90 * day) / 1000),
        paused: false,
      },
    ],
    [
      procurement.contractId,
      {
        token: usdc,
        perTxLimit: u('500'),
        dailyLimit: u('1500'),
        approvalThreshold: u('150'),
        allowlistEnabled: true,
        allowlist: vendors,
        expiresAt: 0,
        paused: false,
      },
    ],
    [
      monitor.contractId,
      {
        token: usdc,
        perTxLimit: u('1'),
        dailyLimit: u('10'),
        approvalThreshold: u('1'),
        allowlistEnabled: false,
        allowlist: [],
        expiresAt: Math.floor((now + 14 * day) / 1000),
        paused: true,
      },
    ],
  ]);

  const balances = new Map<string, string>([
    [research.contractId, u('184.2715')],
    [procurement.contractId, u('3920')],
    [monitor.contractId, u('42.5')],
  ]);

  const payments: PaymentRecord[] = [];
  let ledger = 1_482_310;
  const push = (
    account: AgentAccount,
    to: string,
    amount: string,
    msAgo: number,
    resource?: string,
  ) => {
    ledger += 7 + Math.floor(keys.float() * 40);
    payments.push({
      id: `pay_${keys.hex(6)}`,
      contractId: account.contractId,
      token: usdc,
      to,
      amount: u(amount),
      txHash: keys.hex(32),
      ledger,
      createdAt: iso(msAgo),
      source: resource ? 'x402' : 'direct',
      resource,
    });
  };

  // Research assistant: many x402 micropayments, some today and some on previous days.
  const providers = [keys.account(), keys.account(), keys.account(), keys.account()];
  const microAmounts = [
    '0.002',
    '0.01',
    '0.0035',
    '0.05',
    '0.25',
    '0.12',
    '0.8',
    '1.5',
    '0.02',
    '0.4',
  ];
  for (let i = 0; i < 26; i++) {
    const msAgo = Math.floor(i * 2.9 * hour + keys.float() * 40 * minute);
    push(research, keys.pick(providers), keys.pick(microAmounts), msAgo, keys.pick(RESOURCES));
  }
  // Procurement: few, larger, allowlisted direct payments.
  const procurementPayments: Array<[string, number]> = [
    ['120', 3 * hour],
    ['89.99', 9 * hour],
    ['145', 2 * day],
    ['60', 4 * day],
    ['310', 8 * day],
  ];
  for (const [amount, msAgo] of procurementPayments)
    push(procurement, keys.pick(vendors), amount, msAgo);
  // Monitor: a handful before it was paused.
  for (let i = 0; i < 4; i++) {
    push(monitor, providers[0] as string, '0.3', 30 * hour + i * 2 * hour, RESOURCES[4]);
  }

  payments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const approvals: ApprovalRequest[] = [
    {
      id: `apr_${keys.hex(6)}`,
      contractId: procurement.contractId,
      token: usdc,
      to: vendors[0] as string,
      amount: u('240'),
      reason:
        'Annual renewal for the vendor database subscription. Quote #Q-2291 expires Friday; renewing now keeps the 12 percent discount.',
      status: 'pending',
      createdAt: iso(14 * minute),
      expiresAt: new Date(now + 46 * minute).toISOString(),
    },
    {
      id: `apr_${keys.hex(6)}`,
      contractId: research.contractId,
      token: usdc,
      to: providers[2] as string,
      amount: u('3.5'),
      reason: 'Bulk export of 1,400 paper abstracts for the literature review you requested.',
      status: 'pending',
      createdAt: iso(52 * minute),
      expiresAt: new Date(now + 2 * hour).toISOString(),
    },
    {
      id: `apr_${keys.hex(6)}`,
      contractId: procurement.contractId,
      token: usdc,
      to: vendors[1] as string,
      amount: u('180'),
      reason: 'Replacement SSDs for two build servers, ticket OPS-418.',
      approvalTxHash: keys.hex(32),
      status: 'submitted',
      createdAt: iso(2 * day),
      expiresAt: iso(2 * day - hour),
    },
    {
      id: `apr_${keys.hex(6)}`,
      contractId: research.contractId,
      token: usdc,
      to: providers[1] as string,
      amount: u('4.9'),
      reason: 'Premium dataset access, single request.',
      status: 'rejected',
      createdAt: iso(3 * day),
      expiresAt: iso(3 * day - hour),
    },
  ];

  const apiKeys = new Map<string, string>([
    [research.contractId, `hal_test_${keys.hex(16)}`],
    [procurement.contractId, `hal_test_${keys.hex(16)}`],
    [monitor.contractId, `hal_test_${keys.hex(16)}`],
  ]);

  // One proactive pre-approval the owner created for a known vendor.
  const preApprovals = new Map<string, Map<string, PreApproval>>([
    [
      procurement.contractId,
      new Map([
        [
          vendors[2] as string,
          {
            to: vendors[2] as string,
            amount: u('400'),
            expiresAt: Math.floor((now + 3 * day) / 1000),
          },
        ],
      ]),
    ],
  ]);

  return {
    preApprovals,
    accounts: [research, procurement, monitor],
    policies,
    balances,
    payments,
    approvals,
    apiKeys,
    ownerPublicKey,
    usdc,
  };
}
