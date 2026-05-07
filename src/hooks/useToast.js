import { useState, useCallback } from 'react';

let nextId = 0;

/**
 * useToast — lightweight toast notification manager.
 *
 * Returns { toasts, showToast, dismissToast }.
 *   toasts: [{ id, message, type, duration }]
 *   showToast(message, type?, duration?) — type: 'success'|'error'|'info'|'warning'
 *   dismissToast(id)
 */
export default function useToast() {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'info', duration = 3500) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismissToast(id), duration);
      return id;
    },
    [dismissToast]
  );

  return { toasts, showToast, dismissToast };
}
