import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, listThoughts } from '../api/client';
import type { ThoughtItem } from '../api/types';

export function useThoughts() {
  const [data, setData] = useState<ThoughtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const requestVersion = useRef(0);

  const load = useCallback(async (
    targetGeneration: number,
    failureMessage: string,
  ) => {
    const request = ++requestVersion.current;
    if (isCurrent(mounted, generation, targetGeneration)) setLoading(true);
    try {
      const thoughts = await listThoughts();
      if (
        isCurrent(mounted, generation, targetGeneration)
        && request === requestVersion.current
      ) {
        setData(thoughts);
      }
    } catch (reason) {
      if (
        isCurrent(mounted, generation, targetGeneration)
        && request === requestVersion.current
      ) {
        setError(reason instanceof ApiError ? reason.message : failureMessage);
      }
    } finally {
      if (
        isCurrent(mounted, generation, targetGeneration)
        && request === requestVersion.current
      ) {
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
    };
  }, []);

  useEffect(() => {
    const targetGeneration = ++generation.current;
    setData([]);
    setError(null);
    setLoading(true);
    void load(targetGeneration, '个人思考加载失败');
    return () => {
      if (generation.current === targetGeneration) generation.current += 1;
      requestVersion.current += 1;
    };
  }, [load]);

  return { data, loading, error };
}

function isCurrent(
  mounted: { current: boolean },
  generation: { current: number },
  targetGeneration: number,
) {
  return mounted.current && generation.current === targetGeneration;
}
