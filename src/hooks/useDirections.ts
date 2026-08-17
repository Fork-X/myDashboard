import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, createDirection, deleteDirection, listDirections, scanDirection, updateDirection } from '../api/client';
import type { DirectionItem } from '../api/types';

const MUTATION_BUSY_MESSAGE = '题材操作正在进行中';

export function useDirections() {
  const [data, setData] = useState<DirectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const requestVersion = useRef(0);
  const mutationVersion = useRef(0);
  const mutationLock = useRef(false);

  const loadData = useCallback(async (
    targetGeneration: number, targetMutationVersion: number,
    failureMessage: string, useExactFailureMessage = false,
  ) => {
    const request = ++requestVersion.current;
    if (isCurrent(mounted, generation, targetGeneration)) setLoading(true);
    try {
      const dirs = await listDirections();
      if (isCurrent(mounted, generation, targetGeneration) && request === requestVersion.current) setData(dirs);
    } catch (reason) {
      if (isCurrent(mounted, generation, targetGeneration) && request === requestVersion.current && targetMutationVersion === mutationVersion.current) {
        setError(useExactFailureMessage ? failureMessage : messageOf(reason, failureMessage));
      }
      throw reason;
    } finally {
      if (isCurrent(mounted, generation, targetGeneration) && request === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; requestVersion.current += 1; mutationVersion.current += 1; };
  }, []);

  useEffect(() => {
    const tg = ++generation.current;
    const tm = ++mutationVersion.current;
    setData([]); setError(null); setLoading(true);
    void loadData(tg, tm, '题材列表加载失败').catch(() => undefined);
    return () => { if (generation.current === tg) generation.current += 1; requestVersion.current += 1; mutationVersion.current += 1; };
  }, [loadData]);

  const load = useCallback(async () => {
    const tg = generation.current; const tm = ++mutationVersion.current;
    if (isCurrent(mounted, generation, tg)) setError(null);
    await loadData(tg, tm, '题材列表加载失败');
  }, [loadData]);

  const mutate = useCallback(async (operation: () => Promise<unknown>, mfm: string, rfm: string) => {
    const tg = generation.current; const tm = ++mutationVersion.current;
    if (mutationLock.current) { if (isCurrent(mounted, generation, tg)) setError(MUTATION_BUSY_MESSAGE); throw new ApiError(MUTATION_BUSY_MESSAGE); }
    mutationLock.current = true;
    if (isCurrent(mounted, generation, tg)) setError(null);
    try {
      try { await operation(); } catch (reason) {
        if (isCurrent(mounted, generation, tg) && tm === mutationVersion.current) setError(messageOf(reason, mfm));
        throw reason;
      }
      if (isCurrent(mounted, generation, tg)) {
        try { await loadData(tg, tm, rfm, true); } catch { /* ignored */ }
      }
    } finally { mutationLock.current = false; }
  }, [loadData]);

  const create = useCallback(async (input: { name: string; description?: string; keywords?: string; domain?: string; enabled?: boolean; priority?: number; scanIntervalHours?: number }) => {
    await mutate(() => createDirection(input), '题材保存失败', '题材已保存，但刷新失败');
  }, [mutate]);

  const update = useCallback(async (id: string, patch: Partial<{ name: string; description: string; keywords: string; domain: string; enabled: boolean; priority: number; scanIntervalHours: number }>) => {
    await mutate(() => updateDirection(id, patch), '题材更新失败', '题材已更新，但刷新失败');
  }, [mutate]);

  const remove = useCallback(async (id: string) => {
    await mutate(() => deleteDirection(id), '题材删除失败', '题材已删除，但刷新失败');
  }, [mutate]);

  const scan = useCallback(async (id: string) => {
    await mutate(() => scanDirection(id), '扫描触发失败', '扫描已触发，但刷新失败');
  }, [mutate]);

  return { data, loading, error, load, create, update, remove, scan };
}

function messageOf(reason: unknown, fallback: string) { return reason instanceof ApiError ? reason.message : fallback; }
function isCurrent(m: { current: boolean }, g: { current: number }, t: number) { return m.current && g.current === t; }