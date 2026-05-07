import useBackendStatus from '../../hooks/useBackendStatus.js';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

const BANNER = {
  unreachable: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    text: '#f56565',
    msg: 'Backend no disponible — usando modo mock',
  },
  unhealthy: {
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
    text: '#f59e0b',
    msg: 'Backend degradado — algunos servicios pueden fallar',
  },
  timeout: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    text: '#f56565',
    msg: 'Backend sin respuesta (timeout)',
  },
};

/**
 * BackendStatusBanner — renders a thin sticky warning strip when the backend
 * is unreachable, timed-out, or unhealthy. Hidden in mock mode and when healthy.
 */
export default function BackendStatusBanner() {
  const { status, refresh } = useBackendStatus();

  if (USE_MOCK || status === 'unknown' || status === 'ok') return null;

  const cfg = BANNER[status] ?? BANNER.unreachable;

  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '6px 16px',
        background: cfg.bg,
        borderBottom: `1px solid ${cfg.border}`,
        fontSize: '0.78rem',
        color: cfg.text,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <span>⚠ {cfg.msg}</span>
      <button
        onClick={refresh}
        style={{
          background: 'transparent',
          border: `1px solid ${cfg.border}`,
          color: cfg.text,
          borderRadius: '4px',
          padding: '1px 8px',
          fontSize: '0.72rem',
          cursor: 'pointer',
        }}
      >
        Reintentar
      </button>
    </div>
  );
}
