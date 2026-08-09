import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, createTicker, deleteTicker, listTickers } from '../api/client';
import type { TickerItem } from '../api/types';

const MUTATION_BUSY_MESSAGE = '标的操作正在进行中';

export function useTickers() {
  const [data, setData] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const requestVersion = useRef(0);
  const mutationVersion = useRef(0);
  const mutationLock = useRef(false);

  const loadData = useCallback(async (
    targetGeneration: number,
    targetMutationVersion: number,
    failureMessage: string,
    useExactFailureMessage = false,
  ) => {
    const request = ++requestVersion.current;
    if (isCurrent(mounted, generation, targetGeneration)) setLoading(true);
    try {
      const tickers = await listTickers();
      if (isCurrent(mounted, generation, targetGeneration) && request === requestVersion.current) {
        setData(tickers);
      }
    } catch (reason) {
      if (
        isCurrent(mounted, generation, targetGeneration)
        && request === requestVersion.current
        && targetMutationVersion === mutationVersion.current
      ) {
        setError(useExactFailureMessage ? failureMessage : messageOf(reason, failureMessage));
      }
      throw reason;
    } finally {
      if (isCurrent(mounted, generation, targetGeneration) && request === requestVersion.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      requestVersion.current += 1;
      mutationVersion.current += 1;
    };
  }, []);

  useEffect(() => {
    const targetGeneration = ++generation.current;
    const targetMutationVersion = ++mutationVersion.current;
    setData([]);
    setError(null);
    setLoading(true);
    void loadData(targetGeneration, targetMutationVersion, '标的列表加载失败').catch(() => undefined);
    return () => {
      if (generation.current === targetGeneration) generation.current += 1;
      requestVersion.current += 1;
      mutationVersion.current += 1;
    };
  }, [loadData]);

  const load = useCallback(async () => {
    const targetGeneration = generation.current;
    const targetMutationVersion = ++mutationVersion.current;
    if (isCurrent(mounted, generation, targetGeneration)) setError(null);
    await loadData(targetGeneration, targetMutationVersion, '标的列表加载失败');
  }, [loadData]);

  const mutate = useCallback(async (
    operation: () => Promise<unknown>,
    mutationFailureMessage: string,
    refreshFailureMessage: string,
  ) => {
    const targetGeneration = generation.current;
    const targetMutationVersion = ++mutationVersion.current;
    if (mutationLock.current) {
      if (isCurrent(mounted, generation, targetGeneration)) setError(MUTATION_BUSY_MESSAGE);
      throw new ApiError(MUTATION_BUSY_MESSAGE);
    }
    mutationLock.current = true;
    if (isCurrent(mounted, generation, targetGeneration)) setError(null);
    try {
      try { await operation(); } catch (reason) {
        if (isCurrent(mounted, generation, targetGeneration) && targetMutationVersion === mutationVersion.current) {
          setError(messageOf(reason, mutationFailureMessage));
        }
        throw reason;
      }
      if (isCurrent(mounted, generation, targetGeneration)) {
        try {
          await loadData(targetGeneration, targetMutationVersion, refreshFailureMessage, true);
        } catch { /* ignored */ }
      }
    } finally { mutationLock.current = false; }
  }, [loadData]);

  const create = useCallback(async (input: { symbol: string; name: string; market?: string; notes?: string }) => {
    await mutate(
      () => createTicker(input),
      '标的保存失败',
      '标的已保存，但列表刷新失败',
    );
  }, [mutate]);

  const remove = useCallback(async (id: string) => {
    await mutate(
      () => deleteTicker(id),
      '标的删除失败',
      '标的已删除，但列表刷新失败',
    );
  }, [mutate]);

  return { data, loading, error, load, create, remove };
}

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback;
}

function isCurrent(
  mounted: { current: boolean },
  generation: { current: number },
  targetGeneration: number,
) {
  return mounted.current && generation.current === targetGeneration;
}