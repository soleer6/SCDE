import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { ButtonLink } from '../../ui';
import { getUnreadCount } from './api.js';

export default function NotificationsBell() {
  const { t } = useTranslation('notifications');
  const { session } = useAuth();
  const [count, setCount] = useState(null);
  useEffect(() => {
    let alive = true;
    let timer;
    let sequence = 0;
    const refresh = async () => {
      if (document.hidden || !session) return;
      const current = ++sequence;
      try { const data = await getUnreadCount(); if (alive && current === sequence) setCount(data.unread_count); }
      catch { if (alive && current === sequence) setCount(null); }
    };
    const visibility = () => {
      clearInterval(timer);
      if (!document.hidden) { refresh(); timer = setInterval(refresh, 60000); }
    };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('scde:notifications-read', refresh);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('scde:notifications-read', refresh); };
  }, [session]);
  return <ButtonLink to="/notifications" size="sm" aria-label={count == null ? t('unavailable') : t('unread', { count })}>{t('title')} · {count ?? '—'}</ButtonLink>;
}
