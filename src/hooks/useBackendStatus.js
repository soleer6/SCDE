import { useState, useEffect, useCallback } from 'react';
import { checkHealth } from '../services/healthService.js';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

/**
 * useBackendStatus — polls the /health/ endpoint once on mount (and on demand).
 *
 * Returns:
 *   status: 'unknown' | 'ok' | 'unreachable' | 'unhealthy' | 'timeout'
 *   components: object with per-component health info
 *   refresh: () => void — re-run the check manually
 *
 * In mock mode the check is skipped and status is always 'ok'.
 */
export default function useBackendStatus() {
  const [status, setStatus] = useState('unknown');
  const [components, setComponents] = useState({});

  const refresh = useCallback(async () => {
    if (USE_MOCK) {
      setStatus('ok');
      return;
    }
    const result = await checkHealth();
    setStatus(result.ok ? 'ok' : result.reason);
    setComponents(result.components ?? {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, components, refresh };
}
