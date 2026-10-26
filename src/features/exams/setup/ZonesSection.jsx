import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useTranslation } from 'react-i18next';
import { useAction, useApi } from '../../../lib/hooks.js';
import { Badge, Button, Checkbox, ErrorState, Field, Input, Loader, Select, useToast } from '../../../ui';
import { createPageProfile, createZone, deleteZone, getBlankPdfUrl, listPageProfiles } from '../api.js';
import { fromPdfBox, toPdfBox } from './zoneGeometry.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const ZONE_TYPES = ['QR', 'OCR_TEXT', 'OCR_NUMBER', 'CHECKBOX'];
const pct = (v) => `${Math.round(v * 1000) / 10}`;

/** Recognition zones (RF-6.8) of a model: one page profile per blank-PDF page,
 * each with typed rectangles the ingestion reads (QR, name, NIA, checkboxes).
 * The teacher works in percentages from the top-left corner; the API stores
 * PDF points from the bottom-left (see zoneGeometry.js). */
export default function ZonesSection({ modelId, pages, onError }) {
  const { t } = useTranslation('exams');
  const profiles = useApi(() => listPageProfiles(modelId), [modelId]);
  const [page, setPage] = useState(1);
  const pdfUrl = useBlankPdfUrl(modelId);

  if (profiles.initialLoading) return <Loader label={t('setup.zones.loading')} />;
  if (profiles.error) return <ErrorState error={profiles.error} onRetry={profiles.reload} />;

  const byPage = new Map(profiles.data.map((p) => [p.page_number, p]));
  const profile = byPage.get(page);
  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);

  return (
    <section className="zones" aria-labelledby={`zones-${modelId}`}>
      <div className="zones-head">
        <h3 id={`zones-${modelId}`}>{t('setup.zones.title')}</h3>
        <p className="u-muted">{t('setup.zones.lede')}</p>
      </div>
      <div className="zones-pages" role="group" aria-label={t('setup.zones.pagesLabel')}>
        {pageNumbers.map((n) => {
          const count = byPage.get(n)?.zones.length;
          return (
            <Button key={n} size="sm" variant={n === page ? 'primary' : 'ghost'} aria-pressed={n === page} onClick={() => setPage(n)}>
              {t('setup.zones.page', { n })}
              {count ? ` · ${count}` : ''}
            </Button>
          );
        })}
      </div>
      {profile ? (
        <ProfileEditor key={profile.id} profile={profile} pdf={pdfUrl} pagesWithProfile={[...byPage.keys()]} onChanged={profiles.reload} onError={onError} />
      ) : (
        <EnablePage modelId={modelId} page={page} onCreated={profiles.reload} onError={onError} />
      )}
    </section>
  );
}

/** Blank PDF of the model as an object URL (null while loading or if it fails: the
 * numeric editor keeps working without the preview). */
function useBlankPdfUrl(modelId) {
  const [state, setState] = useState({ url: null, failed: false });
  useEffect(() => {
    let alive = true;
    let made = null;
    getBlankPdfUrl(modelId)
      .then((url) => {
        made = url;
        if (alive) setState({ url, failed: false });
        else URL.revokeObjectURL(url);
      })
      .catch(() => alive && setState({ url: null, failed: true }));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [modelId]);
  return state;
}

function SheetPdf({ pdf, pageNumber }) {
  const { t } = useTranslation('exams');
  const [broken, setBroken] = useState(false);
  const [width, setWidth] = useState(0);
  const [node, setNode] = useState(null);
  useEffect(() => {
    if (!node) return undefined;
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  if (pdf.failed || broken) return <p className="zones-pdf-error u-rust">{t('setup.zones.pdfError')}</p>;
  return (
    <div className="zones-pdf" ref={setNode}>
      {pdf.url && width > 0 && (
        <Document file={pdf.url} onLoadError={() => setBroken(true)} loading={null} error={null}>
          <Page pageNumber={pageNumber} width={width} renderTextLayer={false} renderAnnotationLayer={false} />
        </Document>
      )}
    </div>
  );
}

function EnablePage({ modelId, page, onCreated, onError }) {
  const { t } = useTranslation('exams');
  const create = useAction(() => createPageProfile(modelId, page));
  const run = async () => {
    try {
      await create.run();
      onCreated();
    } catch (err) {
      onError(err);
    }
  };
  return (
    <div className="zones-empty">
      <p>{t('setup.zones.noProfile', { n: page })}</p>
      <Button size="sm" onClick={run} loading={create.pending}>
        {t('setup.zones.enable', { n: page })}
      </Button>
    </div>
  );
}

function ProfileEditor({ profile, pdf, pagesWithProfile, onChanged, onError }) {
  const { t } = useTranslation('exams');
  const toast = useToast();
  const remove = useAction((id) => deleteZone(id));
  const zones = profile.zones.map((z) => ({ ...z, box: fromPdfBox(z, profile) }));

  const onDelete = async (z) => {
    try {
      await remove.run(z.id);
      toast.success(t('setup.zones.deleted'));
      onChanged();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div className="zones-body">
      <div className="zones-sheet" style={{ aspectRatio: `${profile.page_width || 595} / ${profile.page_height || 842}` }} role="img" aria-label={t('setup.zones.sheetLabel', { n: profile.page_number })}>
        <SheetPdf pdf={pdf} pageNumber={profile.page_number} />
        {zones.map((z) => (
          <span
            key={z.id}
            className={`zones-rect zones-rect--${z.zone_type.toLowerCase()}`}
            style={{ left: `${z.box.x * 100}%`, top: `${z.box.y * 100}%`, width: `${z.box.width * 100}%`, height: `${z.box.height * 100}%` }}
          >
            {z.attribute}
          </span>
        ))}
      </div>
      <div className="ui-stack">
        {zones.length === 0 ? (
          <p className="u-muted">{t('setup.zones.none')}</p>
        ) : (
          <ul className="zones-list">
            {zones.map((z) => (
              <li key={z.id}>
                <Badge tone={z.zone_type === 'QR' ? 'green' : 'steel'}>{t(`setup.zones.types.${z.zone_type}`, { defaultValue: z.zone_type })}</Badge>
                <span className="zones-attr">{z.attribute}</span>
                <span className="u-muted u-num">{t('setup.zones.where', { x: pct(z.box.x), y: pct(z.box.y), w: pct(z.box.width), h: pct(z.box.height) })}</span>
                <Button size="sm" variant="ghost" onClick={() => onDelete(z)} loading={remove.pending} aria-label={t('setup.zones.deleteNamed', { name: z.attribute })}>
                  {t('setup.zones.delete')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <NewZoneForm profile={profile} pagesWithProfile={pagesWithProfile} onCreated={onChanged} onError={onError} />
      </div>
    </div>
  );
}

const EMPTY = { zone_type: 'OCR_TEXT', attribute: '', x: '', y: '', width: '', height: '' };

function NewZoneForm({ profile, pagesWithProfile, onCreated, onError }) {
  const { t } = useTranslation('exams');
  const toast = useToast();
  const [f, setF] = useState(EMPTY);
  const [allPages, setAllPages] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const num = (k) => Number(String(f[k]).replace(',', '.')) / 100;
  const box = { x: num('x'), y: num('y'), width: num('width'), height: num('height') };
  const isQr = f.zone_type === 'QR';
  const inRange = ['x', 'y', 'width', 'height'].every((k) => f[k] !== '' && Number.isFinite(box[k]) && box[k] >= 0) && box.width > 0 && box.height > 0;
  const fits = box.x + box.width <= 1 && box.y + box.height <= 1;
  const valid = (isQr || f.attribute.trim()) && inRange && fits;

  const create = useAction(() =>
    createZone(profile.id, {
      zone_type: f.zone_type,
      attribute: isQr ? 'exam_qr' : f.attribute.trim(),
      ...toPdfBox(box, profile),
      ...(allPages && pagesWithProfile.length > 1 ? { page_numbers: [...pagesWithProfile].sort((a, b) => a - b) } : {}),
    }),
  );

  const submit = async (e) => {
    e.preventDefault();
    try {
      const created = await create.run();
      setF(EMPTY);
      setAllPages(false);
      toast.success(t('setup.zones.created', { count: created.length }));
      onCreated();
    } catch (err) {
      onError(err);
    }
  };

  const coord = (k) => (
    <Field label={t(`setup.zones.${k}`)}>{(id) => <Input id={id} inputMode="decimal" value={f[k]} onChange={set(k)} className="setup-num" />}</Field>
  );

  return (
    <form className="zones-form" onSubmit={submit} aria-label={t('setup.zones.newZone')}>
      <div className="setup-inline">
        <Field label={t('setup.zones.type')}>
          {(id) => (
            <Select id={id} value={f.zone_type} onChange={set('zone_type')}>
              {ZONE_TYPES.map((z) => (
                <option key={z} value={z}>
                  {t(`setup.zones.types.${z}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('setup.zones.attribute')} hint={isQr ? t('setup.zones.qrHint') : t('setup.zones.attributeHint')}>
          {(id) => <Input id={id} value={isQr ? 'exam_qr' : f.attribute} onChange={set('attribute')} disabled={isQr} />}
        </Field>
      </div>
      <div className="setup-inline">
        {coord('x')}
        {coord('y')}
        {coord('width')}
        {coord('height')}
      </div>
      <p className="u-muted zones-hint">{inRange && !fits ? t('setup.zones.outside') : t('setup.zones.coordsHint')}</p>
      <div className="setup-inline">
        {pagesWithProfile.length > 1 && <Checkbox label={t('setup.zones.allPages', { count: pagesWithProfile.length })} checked={allPages} onChange={(e) => setAllPages(e.target.checked)} />}
        <Button type="submit" variant="primary" disabled={!valid} loading={create.pending}>
          {t('setup.zones.add')}
        </Button>
      </div>
    </form>
  );
}
