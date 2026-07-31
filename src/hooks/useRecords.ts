import { useEffect, useState } from 'react';
import { ApiError, listRecords } from '../api/client';
import type { RecordDomain, RecordForDomain } from '../api/types';

export function useRecords<TDomain extends RecordDomain>(
  domain: TDomain,
) {
  const [data, setData] = useState<RecordForDomain<TDomain>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData([]);
    setError(null);
    setLoading(true);
    listRecords(domain)
      .then((records) => {
        if (active) setData(records);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof ApiError ? reason.message : '本地数据加载失败');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [domain]);

  return { data, loading, error };
}
