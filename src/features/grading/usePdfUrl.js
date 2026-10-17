import { useEffect, useState } from 'react';
import { getInstancePdfUrl } from './api.js';

/** Downloads an instance PDF as an object URL and revokes it on change/unmount. */
export function usePdfUrl(instanceId) {
  const [state, setState] = useState({ id: null, url: null, error: null });

  useEffect(() => {
    let url;
    let alive = true;
    getInstancePdfUrl(instanceId)
      .then((u) => {
        url = u;
        if (alive) setState({ id: instanceId, url: u, error: null });
        else URL.revokeObjectURL(u);
      })
      .catch((error) => alive && setState({ id: instanceId, url: null, error }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [instanceId]);

  const current = state.id === instanceId;
  return { url: current ? state.url : null, error: current ? state.error : null };
}
