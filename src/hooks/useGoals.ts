import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  appendGoalProgress,
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
} from '../api/client';
import type { GoalItem, GoalStatus } from '../api/types';

const MUTATION_BUSY_MESSAGE = '目标操作正在进行中';

export function useGoals() {
  const [data, setData] = useState<GoalItem[]>([]);
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
      const goals = await listGoals();
      if (
        isCurrent(mounted, generation, targetGeneration)
        && request === requestVersion.current
      ) {
        setData(goals);
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
    void loadData(targetGeneration, targetMutationVersion, '本地目标加载失败')
      .catch(() => undefined);
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
    await loadData(targetGeneration, targetMutationVersion, '本地目标加载失败');
  }, [loadData]);

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
    if (isCurrent(mounted, generation, targetGeneration)) setError(null);
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
          await loadData(
            targetGeneration,
            targetMutationVersion,
            refreshFailureMessage,
            true,
          );
        } catch {
          // The write succeeded; loadData already exposed the distinct refresh error.
        }
      }
    } finally {
      mutationLock.current = false;
    }
  }, [loadData]);

  const create = useCallback(async (input: {
    title: string;
    description?: string;
    status?: GoalStatus;
  }) => {
    await mutate(
      () => createGoal(input),
      '本地目标保存失败',
      '目标已保存，但列表刷新失败',
    );
  }, [mutate]);

  const update = useCallback(async (
    id: string,
    patch: { title?: string; description?: string; status?: GoalStatus },
  ) => {
    await mutate(
      () => updateGoal(id, patch),
      '本地目标更新失败',
      '目标已更新，但列表刷新失败',
    );
  }, [mutate]);

  const remove = useCallback(async (id: string) => {
    await mutate(
      () => deleteGoal(id),
      '本地目标删除失败',
      '目标已删除，但列表刷新失败',
    );
  }, [mutate]);

  const appendProgress = useCallback(async (goalId: string, content: string) => {
    await mutate(
      () => appendGoalProgress(goalId, { content }),
      '目标进展保存失败',
      '目标进展已保存，但列表刷新失败',
    );
  }, [mutate]);

  return { data, loading, error, load, create, update, remove, appendProgress };
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
