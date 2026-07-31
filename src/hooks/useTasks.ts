import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, createTask, listTasks, patchTask } from '../api/client';
import type { TaskItem } from '../api/types';

const MUTATION_BUSY_MESSAGE = '任务操作正在进行中';

export function useTasks(kind: TaskItem['kind']) {
  const [data, setData] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const requestVersion = useRef(0);
  const mutationVersion = useRef(0);
  const mutationLock = useRef(false);

  const load = useCallback(async (
    targetKind: TaskItem['kind'],
    targetGeneration: number,
    targetMutationVersion: number,
    failureMessage: string,
    useExactFailureMessage = false,
  ) => {
    const request = ++requestVersion.current;
    if (isCurrent(mounted, generation, targetGeneration)) {
      setLoading(true);
    }
    try {
      const tasks = await listTasks(targetKind);
      if (
        isCurrent(mounted, generation, targetGeneration)
        && request === requestVersion.current
      ) {
        setData(tasks);
      }
    } catch (reason) {
      if (
        isCurrent(mounted, generation, targetGeneration)
        && request === requestVersion.current
        && targetMutationVersion === mutationVersion.current
      ) {
        setError(useExactFailureMessage
          ? failureMessage
          : messageOf(reason, failureMessage));
      }
      throw reason;
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
      mutationVersion.current += 1;
    };
  }, []);

  useEffect(() => {
    const targetGeneration = ++generation.current;
    const targetMutationVersion = ++mutationVersion.current;
    setData([]);
    setError(null);
    setLoading(true);
    void load(
      kind,
      targetGeneration,
      targetMutationVersion,
      '本地任务加载失败',
    ).catch(() => undefined);
    return () => {
      if (generation.current === targetGeneration) {
        generation.current += 1;
      }
      requestVersion.current += 1;
      mutationVersion.current += 1;
    };
  }, [kind, load]);

  const refresh = useCallback(async () => {
    const targetGeneration = generation.current;
    const targetMutationVersion = ++mutationVersion.current;
    if (isCurrent(mounted, generation, targetGeneration)) {
      setError(null);
    }
    await load(
      kind,
      targetGeneration,
      targetMutationVersion,
      '本地任务加载失败',
    );
  }, [kind, load]);

  const mutate = useCallback(async (
    operation: () => Promise<unknown>,
    mutationFailureMessage: string,
    refreshFailureMessage: string,
  ) => {
    const targetGeneration = generation.current;
    const targetMutationVersion = ++mutationVersion.current;

    if (mutationLock.current) {
      if (isCurrent(mounted, generation, targetGeneration)) {
        setError(MUTATION_BUSY_MESSAGE);
      }
      throw new ApiError(MUTATION_BUSY_MESSAGE);
    }

    mutationLock.current = true;
    if (isCurrent(mounted, generation, targetGeneration)) {
      setError(null);
    }
    try {
      try {
        await operation();
      } catch (reason) {
        if (
          isCurrent(mounted, generation, targetGeneration)
          && targetMutationVersion === mutationVersion.current
        ) {
          setError(messageOf(reason, mutationFailureMessage));
        }
        throw reason;
      }

      if (isCurrent(mounted, generation, targetGeneration)) {
        try {
          await load(
            kind,
            targetGeneration,
            targetMutationVersion,
            refreshFailureMessage,
            true,
          );
        } catch {
          // Persistence succeeded; the distinct refresh error is already exposed.
        }
      }
    } finally {
      mutationLock.current = false;
    }
  }, [kind, load]);

  const add = useCallback(async (input: {
    title: string;
    description: string;
  }) => {
    await mutate(
      async () => {
        await createTask(input);
      },
      '本地任务保存失败',
      '任务已保存，但列表刷新失败',
    );
  }, [mutate]);

  const setStatus = useCallback(async (
    id: string,
    status: TaskItem['status'],
  ) => {
    await mutate(
      async () => {
        await patchTask(id, status);
      },
      '本地任务更新失败',
      '任务状态已保存，但列表刷新失败',
    );
  }, [mutate]);

  return { data, loading, error, refresh, add, setStatus };
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
