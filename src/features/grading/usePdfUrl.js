import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { getInstancePdfUrl } from './api.js';

/** Downloads an instance PDF as an object URL (decrypting the student copy
 *  with the signed-in user's key) and revokes it on change/unmount. */
export function usePdfUrl(instanceId) {
  const { session } = useAuth();
  const userId = session?.id;
  const [state, setState] = useState({ id: null, url: null, error: null });

  useEffect(() => {
    let url;
    let alive = true;
    getInstancePdfUrl(instanceId, userId)
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
  }, [instanceId, userId]);

  const current = state.id === instanceId;
  return { url: current ? state.url : null, error: current ? state.error : null };
}
