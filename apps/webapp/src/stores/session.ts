'use client';

import { create } from 'zustand';
import { config } from '@/lib/config';
import { getOwnerWallet, type OwnerSession } from '@/services';

type SessionState = {
  status: 'disconnected' | 'connecting' | 'connected';
  publicKey: string | null;
  error: string | null;
  /** Bumped after every successful write so open views refetch. */
  revision: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  invalidate: () => void;
};

export const useSession = create<SessionState>((set, get) => ({
  status: 'disconnected',
  publicKey: null,
  error: null,
  revision: 0,
  connect: async () => {
    if (get().status === 'connecting') return;
    set({ status: 'connecting', error: null });
    try {
      const publicKey = await getOwnerWallet().connect();
      set({ status: 'connected', publicKey });
    } catch (err) {
      set({
        status: 'disconnected',
        publicKey: null,
        error: err instanceof Error ? err.message : 'The wallet did not connect.',
      });
    }
  },
  disconnect: async () => {
    await getOwnerWallet().disconnect();
    set({ status: 'disconnected', publicKey: null, error: null });
  },
  invalidate: () => set((s) => ({ revision: s.revision + 1 })),
}));

/** The owner session for data-layer calls, or null when no wallet is connected. */
export function useOwnerSession(): OwnerSession | null {
  const publicKey = useSession((s) => s.publicKey);
  if (!publicKey) return null;
  return { publicKey, wallet: getOwnerWallet(), network: config.network };
}
