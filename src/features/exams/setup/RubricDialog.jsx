import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAction } from '../../../lib/hooks.js';
import { formatScore } from '../../../lib/format.js';
import { Button, Dialog, Input, useToast } from '../../../ui';
import { setRubric } from '../api.js';

/** Edits a problem's rubric. POST /problems/{id}/rubric/ REPLACES all criteria.
 *  The backend does not check that criteria add up to max_score; the UI warns. */
export default function RubricDialog({ problem, onClose, onSaved }) {
  if (!problem) return null;
  return <RubricEditor key={problem.id} problem={problem} onClose={onClose} onSaved={onSaved} />;
}

function RubricEditor({ problem, onClose, onSaved }) {
  const { t } = useTranslation('exams');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const [rows, setRows] = useState(() =>
    problem.rubric_criteria.length ? problem.rubric_criteria.map((c) => ({ description: c.description, score: String(Number(c.score)) })) : [{ description: '', score: '' }],
  );
  const num = (v) => Number(String(v).replace(',', '.'));
  const clean = rows.filter((r) => r.description.trim() && !Number.isNaN(num(r.score)) && r.score !== '');
  const sum = clean.reduce((a, r) => a + num(r.score), 0);
  const max = Number(problem.max_score);
  const save = useAction(() => setRubric(problem.id, clean.map((r) => ({ description: r.description.trim(), score: String(num(r.score)) }))));

  const update = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    try {
      await save.run();
      toast.success(t('setup.rubric.saved'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error(tc(`errors.${e.code}`, { defaultValue: e.code }));
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('setup.rubric.title', { name: problem.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="solid" onClick={submit} loading={save.pending}>
            {t('setup.rubric.save')}
          </Button>
        </>
      }
    >
      <p className="u-muted">{t('setup.rubric.help')}</p>
      <ol className="setup-rubric">
        {rows.map((r, i) => (
          <li key={i}>
            <Input aria-label={t('setup.rubric.description', { n: i + 1 })} value={r.description} onChange={(e) => update(i, { description: e.target.value })} placeholder={t('setup.rubric.descriptionPlaceholder')} />
            <Input aria-label={t('setup.rubric.score', { n: i + 1 })} inputMode="decimal" value={r.score} onChange={(e) => update(i, { score: e.target.value })} className="setup-num" placeholder="0" />
            <Button size="sm" variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={t('setup.rubric.remove', { n: i + 1 })}>
              ✕
            </Button>
          </li>
        ))}
      </ol>
      <div className="ui-row">
        <Button size="sm" onClick={() => setRows((rs) => [...rs, { description: '', score: '' }])}>
          {t('setup.rubric.add')}
        </Button>
        <span className={sum > max ? 'u-rust' : 'u-muted'}>{t('setup.rubric.sum', { sum: formatScore(sum), max: formatScore(max) })}</span>
      </div>
      {clean.length === 0 && <p className="u-muted">{t('setup.rubric.emptyMeansManual')}</p>}
    </Dialog>
  );
}
