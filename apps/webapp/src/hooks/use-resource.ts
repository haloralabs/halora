'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/stores/session';

export type Resource<T> = {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

/**
 * Minimal async loader. Refetches when `key` changes or when any write bumps the session
 * revision. Stale responses from an earlier key are ignored.
 */
export function useResource<T>(key: string | null, load: () => Promise<T>): Resource<T> {
  const revision = useSession((s) => s.revision);
  const [state, setState] = useState<{
    data: T | undefined;
    error: string | null;
    loading: boolean;
  }>({
    data: undefined,
    error: null,
    loading: key !== null,
  });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marks the start of an async load
    setState((s) => ({ ...s, loading: true, error: null }));
    loadRef.current().then(
      (data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      },
      (err: unknown) => {
        if (!cancelled) {
          setState((s) => ({
            data: s.data,
            error: err instanceof Error ? err.message : 'Something went wrong.',
            loading: false,
          }));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, revision, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
