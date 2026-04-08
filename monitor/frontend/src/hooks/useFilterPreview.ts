// useFilterPreview — debounced filter preview via the backend API.
import { useState, useEffect } from 'react';
import type { FilterConfig, TracePoint } from '../types';

export function useFilterPreview(
  rawPoints: TracePoint[],
  filterConfig: FilterConfig,
  enabled: boolean,
) {
  const [filtered, setFiltered] = useState<TracePoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || rawPoints.length === 0) {
      setFiltered(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/editor/preview-filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            raw_trace: rawPoints.map(({ id: _id, ...rest }) => rest),
            filter_config: filterConfig,
          }),
        });
        if (res.ok) {
          const data = await res.json() as { filtered: Omit<TracePoint, 'id'>[] };
          // Re-assign stable ids based on t value matching
          const tMap = new Map(rawPoints.map(p => [p.t, p.id]));
          setFiltered(
            data.filtered.map((p, i) => ({
              ...p,
              id: tMap.get(p.t) ?? -(i + 1),
            }))
          );
        }
      } catch {
        // Network error — silently clear
        setFiltered(null);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPoints, JSON.stringify(filterConfig), enabled]);

  return { filtered, loading };
}
