import { useEffect, useRef } from 'react';

const COLORS = {
  success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#10b981', icon: '✓' },
  error:   { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  text: '#f56565', icon: '✕' },
  warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#f59e0b', icon: '!' },
  info:    { bg: 'rgba(99,179,237,0.15)', border: 'rgba(99,179,237,0.4)', text: '#63b3ed', icon: 'i' },
};

function ToastItem({ toast, onDismiss }) {
  const c = COLORS[toast.type] ?? COLORS.info;
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
  }, []);

  return (
    <div
      ref={ref}
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: '10px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        maxWidth: '360px',
        pointerEvents: 'auto',
        cursor: 'default',
      }}
    >
      <span style={{
        width: '20px', height: '20px', borderRadius: '50%',
        background: c.border, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700,
        color: c.text, flexShrink: 0,
      }}>
        {c.icon}
      </span>
      <span style={{ fontSize: '0.85rem', color: '#e2e8f0', flex: 1, lineHeight: 1.4 }}>
        {toast.message}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        style={{
          background: 'transparent', border: 'none', color: '#718096',
          cursor: 'pointer', padding: '2px', fontSize: '1rem', lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * ToastContainer — renders all active toasts anchored to the bottom-right.
 * Props: { toasts, onDismiss }
 */
export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
