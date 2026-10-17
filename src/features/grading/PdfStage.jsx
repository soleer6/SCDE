import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useTranslation } from 'react-i18next';
import { Button, Loader } from '../../ui';
import InkCanvas from './InkCanvas.jsx';
import './grading.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const INKS = ['--ink-red', '--ink-blue', '--ink-green', '--ink-black'];
const WIDTHS = [0.0018, 0.0035, 0.007];
const ZOOMS = [0.75, 1, 1.25, 1.5, 2];

/** Ink colours are stored in the payload as literal values (portable), read from tokens. */
const readInk = (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#d6342c'; // audit-ignore: fallback

/**
 * PDF "light table": dark grid stage, white sheet, ink layer on top.
 * annotations: return value of useAnnotations (or a read-only subset).
 */
export default function PdfStage({ url, annotations, readOnly = false, aside }) {
  const { t } = useTranslation('grading');
  const wrap = useRef(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState(0);
  const [tool, setTool] = useState('pen');
  const [ink, setInk] = useState(INKS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const color = useMemo(() => readInk(ink), [ink]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBox(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setPage((p) => Math.min(p + 1, pages || 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setPage((p) => Math.max(p - 1, 1));
      if (!readOnly && (e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        annotations.undo(page);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages, page, readOnly, annotations]);

  const pageWidth = Math.max(Math.min(box - 64, 900) * zoom, 200);
  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="gr-stage-wrap">
      <div className="gr-toolbar" role="toolbar" aria-label={t('toolbar.label')}>
        <div className="gr-toolbar__group">
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1} aria-label={t('toolbar.prev')}>
            ←
          </Button>
          <span className="gr-pager u-num">
            {pad(page)} <span className="u-muted">/ {pad(pages || 1)}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(p + 1, pages))} disabled={page >= pages} aria-label={t('toolbar.next')}>
            →
          </Button>
        </div>

        {!readOnly && (
          <div className="gr-toolbar__group">
            <button type="button" className={`gr-tool ${tool === 'pen' ? 'is-on' : ''}`} onClick={() => setTool('pen')} aria-pressed={tool === 'pen'}>
              {t('toolbar.pen')}
            </button>
            <button type="button" className={`gr-tool ${tool === 'eraser' ? 'is-on' : ''}`} onClick={() => setTool('eraser')} aria-pressed={tool === 'eraser'}>
              {t('toolbar.eraser')}
            </button>
            <span className="gr-sep" aria-hidden="true" />
            {INKS.map((k) => (
              <button
                key={k}
                type="button"
                className={`gr-swatch ${ink === k && tool === 'pen' ? 'is-on' : ''}`}
                style={{ '--sw': `var(${k})` }}
                onClick={() => {
                  setInk(k);
                  setTool('pen');
                }}
                aria-label={t(`toolbar.inks.${k.slice(6)}`)}
                aria-pressed={ink === k}
              />
            ))}
            <span className="gr-sep" aria-hidden="true" />
            {WIDTHS.map((w, i) => (
              <button key={w} type="button" className={`gr-width ${width === w ? 'is-on' : ''}`} onClick={() => setWidth(w)} aria-label={t('toolbar.width', { n: i + 1 })}>
                <i style={{ height: `${1 + i * 2}px` }} />
              </button>
            ))}
            <span className="gr-sep" aria-hidden="true" />
            <Button size="sm" variant="ghost" onClick={() => annotations.undo(page)}>
              {t('toolbar.undo')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => annotations.clearPage(page)}>
              {t('toolbar.clear')}
            </Button>
          </div>
        )}

        <div className="gr-toolbar__group">
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => ZOOMS[Math.max(ZOOMS.indexOf(z) - 1, 0)])} aria-label={t('toolbar.zoomOut')}>
            −
          </Button>
          <span className="gr-pager u-num">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.indexOf(z) + 1, ZOOMS.length - 1)])} aria-label={t('toolbar.zoomIn')}>
            +
          </Button>
        </div>
        {aside}
      </div>

      <div className="gr-stage" ref={wrap}>
        {!url ? (
          <Loader page label={t('stage.loadingPdf')} />
        ) : loadError ? (
          <p className="gr-stage__msg u-rust">{t('stage.pdfError')}</p>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => {
              setPages(numPages);
              setPage((p) => Math.min(p, numPages));
            }}
            onLoadError={setLoadError}
            loading={<Loader page label={t('stage.loadingPdf')} />}
            className="gr-doc"
          >
            <div className="gr-sheet" style={{ width: pageWidth }}>
              <Page pageNumber={page} width={pageWidth} renderTextLayer={false} renderAnnotationLayer={false} />
              {annotations && !annotations.loading && (
                <InkCanvas
                  strokes={annotations.strokesByPage[page] ?? []}
                  tool={tool}
                  color={color}
                  width={width}
                  readOnly={readOnly}
                  onStroke={(s) => annotations.addStroke(page, s)}
                />
              )}
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}
