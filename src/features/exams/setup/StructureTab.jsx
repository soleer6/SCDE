import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAction, useApi } from '../../../lib/hooks.js';
import { formatScore } from '../../../lib/format.js';
import { Badge, Button, DataTable, EmptyState, Field, Input, Panel, Select, useToast } from '../../../ui';
import { createModel, createProblem, generateQrPdf, getModel, uploadBlankPdf } from '../api.js';
import RubricDialog from './RubricDialog.jsx';
import ZonesSection from './ZonesSection.jsx';

/** Models (variants) of the exam, their blank PDF and their problems + rubrics. */
export default function StructureTab({ exam, perms, onChanged }) {
  const { t } = useTranslation('exams');
  const models = exam.models_problems ?? [];
  return (
    <div className="ui-stack">
      {models.length === 0 && <EmptyState title={t('setup.structure.emptyTitle')} body={t('setup.structure.emptyBody')} />}
      {models.map((m) => (
        <ModelBlock key={m.model_id} model={m} perms={perms} onChanged={onChanged} />
      ))}
      {perms.exams && <NewModelForm examId={exam.id} models={models} onCreated={onChanged} />}
    </div>
  );
}

function useErrorToast() {
  const { t } = useTranslation('exams');
  const { t: tc } = useTranslation();
  const toast = useToast();
  return (e) => toast.error(t(`setup.errors.${e.code}`, { defaultValue: tc(`errors.${e.code}`, { defaultValue: e.code }) }));
}

function ModelBlock({ model, perms, onChanged }) {
  const { t } = useTranslation('exams');
  const toast = useToast();
  const fail = useErrorToast();
  const detail = useApi(perms.exams ? () => getModel(model.model_id) : null, [model.model_id]);
  const fileRef = useRef(null);
  const [rubricFor, setRubricFor] = useState(null);
  const upload = useAction((file) => uploadBlankPdf(model.model_id, file));
  const qr = useAction(() => generateQrPdf(model.model_id));
  const total = model.problems.reduce((a, p) => a + Number(p.max_score), 0);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const res = await upload.run(file);
      toast.success(t('setup.structure.pdfUploaded', { pages: res.pages }));
      detail.reload();
    } catch (err) {
      fail(err);
    }
  };

  const onQr = async () => {
    try {
      const blob = await qr.run();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `modelo-${model.label}-qr.pdf` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      fail(err);
    }
  };

  const pages = detail.data?.blank_pdf_pages ?? 0;

  return (
    <Panel
      title={t('setup.structure.model', { label: model.label })}
      flush
      actions={
        perms.exams && (
          <>
            {detail.data && (pages ? <Badge tone="green">{t('setup.structure.pdfPages', { count: pages })}</Badge> : <Badge tone="gold">{t('setup.structure.noPdf')}</Badge>)}
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onFile} />
            <Button size="sm" onClick={() => fileRef.current?.click()} loading={upload.pending}>
              {pages ? t('setup.structure.replacePdf') : t('setup.structure.uploadPdf')}
            </Button>
            <Button size="sm" variant="primary" onClick={onQr} loading={qr.pending} disabled={!pages}>
              {t('setup.structure.qr')}
            </Button>
          </>
        )
      }
    >
      <DataTable
        caption={t('setup.structure.model', { label: model.label })}
        rows={model.problems}
        empty={<p className="setup-pad u-muted">{t('setup.structure.noProblems')}</p>}
        columns={[
          { key: 'order', header: '#', render: (p) => <span className="u-num">{String(p.order).padStart(2, '0')}</span> },
          { key: 'name', header: t('setup.structure.problem') },
          { key: 'max', header: t('setup.structure.max'), align: 'num', render: (p) => formatScore(p.max_score) },
          {
            key: 'rubric',
            header: t('setup.structure.rubric'),
            render: (p) =>
              p.rubric_criteria.length ? t('setup.structure.criteria', { count: p.rubric_criteria.length }) : <span className="u-muted">{t('setup.structure.manual')}</span>,
          },
          {
            key: 'actions',
            header: '',
            render: (p) =>
              perms.rubric && (
                <Button size="sm" variant="ghost" onClick={() => setRubricFor(p)}>
                  {t('setup.structure.editRubric')}
                </Button>
              ),
          },
        ]}
      />
      <div className="setup-foot">
        <span className="u-muted">
          {t('setup.structure.total')} <b className="u-num">{formatScore(total)}</b>
        </span>
        {perms.rubric && <NewProblemForm modelId={model.model_id} nextOrder={model.problems.length + 1} onCreated={onChanged} />}
      </div>
      {perms.exams && pages > 0 && <ZonesSection modelId={model.model_id} pages={pages} onError={fail} />}
      <RubricDialog problem={rubricFor} onClose={() => setRubricFor(null)} onSaved={onChanged} />
    </Panel>
  );
}

function NewProblemForm({ modelId, nextOrder, onCreated }) {
  const { t } = useTranslation('exams');
  const toast = useToast();
  const fail = useErrorToast();
  const [name, setName] = useState('');
  const [max, setMax] = useState('');
  const create = useAction(() => createProblem(modelId, { name: name.trim(), max_score: String(Number(max.replace(',', '.'))), order: nextOrder }));
  const valid = name.trim() && Number(max.replace(',', '.')) > 0;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await create.run();
      setName('');
      setMax('');
      toast.success(t('setup.structure.problemAdded'));
      onCreated();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <form className="setup-inline" onSubmit={submit}>
      <Field label={t('setup.structure.newProblem')}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('setup.structure.problemPlaceholder')} />}</Field>
      <Field label={t('setup.structure.max')}>{(id) => <Input id={id} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className="setup-num" />}</Field>
      <Button type="submit" variant="primary" disabled={!valid} loading={create.pending}>
        {t('setup.structure.addProblem')}
      </Button>
    </form>
  );
}

function NewModelForm({ examId, models, onCreated }) {
  const { t } = useTranslation('exams');
  const toast = useToast();
  const fail = useErrorToast();
  const [label, setLabel] = useState('');
  const [copy, setCopy] = useState('');
  const create = useAction(() => createModel(examId, { label: label.trim(), ...(copy ? { copy_from_id: copy } : {}) }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await create.run();
      setLabel('');
      setCopy('');
      toast.success(t('setup.structure.modelAdded'));
      onCreated();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <Panel title={t('setup.structure.newModel')}>
      <form className="setup-inline" onSubmit={submit}>
        <Field label={t('setup.structure.label')} hint={t('setup.structure.labelHint')}>
          {(id) => <Input id={id} value={label} onChange={(e) => setLabel(e.target.value)} className="setup-num" />}
        </Field>
        {models.length > 0 && (
          <Field label={t('setup.structure.copyFrom')}>
            {(id) => (
              <Select id={id} value={copy} onChange={(e) => setCopy(e.target.value)}>
                <option value="">{t('setup.structure.copyNone')}</option>
                {models.map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {t('setup.structure.model', { label: m.label })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Button type="submit" variant="primary" disabled={!label.trim()} loading={create.pending}>
          {t('setup.structure.addModel')}
        </Button>
      </form>
    </Panel>
  );
}
