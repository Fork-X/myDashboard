import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, convertInboxItem, ignoreInboxItem, listInboxItems, updateInboxItem } from '../api/client';
import type { InboxItem } from '../api/types';

const MUTATION_BUSY_MESSAGE = '收件箱操作正在进行中';

export function useInbox() {
  const [data, setData] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const requestVersion = useRef(0);
  const mutationVersion = useRef(0);
  const mutationLock = useRef(false);

  const loadData = useCallback(async (tg: number, tm: number, fm: string, uefm = false) => {
    const req = ++requestVersion.current;
    if (isCurrent(mounted, generation, tg)) setLoading(true);
    try {
      const items = await listInboxItems();
      if (isCurrent(mounted, generation, tg) && req === requestVersion.current) setData(items);
    } catch (reason) {
      if (isCurrent(mounted, generation, tg) && req === requestVersion.current && tm === mutationVersion.current) {
        setError(uefm ? fm : messageOf(reason, fm));
      }
      throw reason;
    } finally {
      if (isCurrent(mounted, generation, tg) && req === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; requestVersion.current += 1; mutationVersion.current += 1; };
  }, []);

  useEffect(() => {
    const tg = ++generation.current; const tm = ++mutationVersion.current;
    setData([]); setError(null); setLoading(true);
    void loadData(tg, tm, '收件箱加载失败').catch(() => undefined);
    return () => { if (generation.current === tg) generation.current += 1; requestVersion.current += 1; mutationVersion.current += 1; };
  }, [loadData]);

  const mutate = useCallback(async (op: () => Promise<unknown>, mfm: string, rfm: string) => {
    const tg = generation.current; const tm = ++mutationVersion.current;
    if (mutationLock.current) { if (isCurrent(mounted, generation, tg)) setError(MUTATION_BUSY_MESSAGE); throw new ApiError(MUTATION_BUSY_MESSAGE); }
    mutationLock.current = true;
    if (isCurrent(mounted, generation, tg)) setError(null);
    try {
      try { await op(); } catch (reason) {
        if (isCurrent(mounted, generation, tg) && tm === mutationVersion.current) setError(messageOf(reason, mfm));
        throw reason;
      }
      if (isCurrent(mounted, generation, tg)) {
        try { await loadData(tg, tm, rfm, true); } catch { /* ignored */ }
      }
    } finally { mutationLock.current = false; }
  }, [loadData]);

  const update = useCallback(async (id: string, patch: {
    aiEventName?: string; aiEventStartDate?: string; aiEventEndDate?: string;
    dateConfidence?: string; aiTags?: string[]; aiTickers?: { symbol: string; name: string }[];
  }) => {
    await mutate(() => updateInboxItem(id, patch), '收件箱条目更新失败', '条目已更新，但刷新失败');
  }, [mutate]);

  const convert = useCallback(async (id: string) => {
    await mutate(() => convertInboxItem(id), '转换失败', '转换成功，但刷新失败');
  }, [mutate]);

  const ignore = useCallback(async (id: string) => {
    await mutate(() => ignoreInboxItem(id), '忽略失败', '已忽略，但刷新失败');
  }, [mutate]);

  return { data, loading, error, update, convert, ignore };
}

function messageOf(reason: unknown, fallback: string) { return reason instanceof ApiError ? reason.message : fallback; }
function isCurrent(m: { current: boolean }, g: { current: number }, t: number) { return m.current && g.current === t; }