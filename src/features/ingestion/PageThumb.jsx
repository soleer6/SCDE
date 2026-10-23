import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Skeleton } from '../../ui';
import { getPageImageUrl } from './api.js';

/** Thumbnail of a scanned page (GET /pages/{id}/image/, Bearer); click to enlarge.
 * `image_url` is null when the user may not inspect the page: nothing is fetched. */
export default function PageThumb({ page, label }) {
  const { t } = useTranslation('ingestion');
  // Tagged with the image it belongs to, so a stale result reads as loading.
  const [loaded, setLoaded] = useState({ src: null, url: null, failed: false });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!page.image_url) return undefined;
    const ctrl = new AbortController();
    const src = page.image_url;
    let url = null;
    getPageImageUrl(page.image_url, ctrl.signal).then(
      (u) => {
        url = u;
        if (ctrl.signal.aborted) URL.revokeObjectURL(u);
        else setLoaded({ src, url: u, failed: false });
      },
      (e) => {
        if (e?.name !== 'AbortError') setLoaded({ src, url: null, failed: true });
      },
    );
    return () => {
      ctrl.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [page.image_url]);

  const state = loaded.src === page.image_url ? loaded : { url: null, failed: false };
  if (!page.image_url) return <span className="u-muted in-thumb-none">—</span>;
  if (state.failed) return <span className="u-muted in-thumb-none">{t('pages.noImage')}</span>;
  if (!state.url) return <Skeleton width="48px" height="68px" />;
  return (
    <>
      <button type="button" className="in-thumb" onClick={() => setOpen(true)} aria-label={t('pages.enlarge', { label })}>
        <img src={state.url} alt="" />
      </button>
      {open && (
        <Dialog open onClose={() => setOpen(false)} title={label}>
          <img className="in-scan" src={state.url} alt={t('pages.imageAlt', { label })} />
        </Dialog>
      )}
    </>
  );
}
