import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatScore } from '../../lib/format.js';
import { Checkbox, Input } from '../../ui';
import { gradeManual, gradeRubric } from './api.js';

/**
 * One problem row. Rubric problems grade by criteria (PUT .../rubric/),
 * the rest by a manual score (PUT .../grade/). Both send old_score for
 * optimistic concurrency; known.grades holds what we last saved.
 * known.grades[pid] = { score: "2.50", criteria?: [ids] }
 */
export default function ProblemGrader({ instanceId, problem, known, disabled, onSaved }) {
  const { t } = useTranslation('grading');
  const { t: tc } = useTranslation();
  const current = known.grades[problem.id];
  const [draft, setDraft] = useState(current?.score != null ? String(Number(current.score)) : '');
  const [state, setState] = useState(current ? 'saved' : 'idle');
  const [errCode, setErrCode] = useState(null);
  const max = Number(problem.max_score);
  const rubric = problem.rubric_criteria ?? [];

  const save = async (fn) => {
    setState('saving');
    setErrCode(null);
    try {
      const res = await fn(current?.score ?? null);
      known.remember(problem.id, { score: res.score, criteria: res.rubric_selections?.map((r) => r.criterion_id) });
      setDraft(String(Number(res.score)));
      setState('saved');
      onSaved?.();
    } catch (e) {
      setState('error');
      setErrCode(e.code);
    }
  };

  const commitManual = () => {
    if (draft === '' || disabled) return;
    const n = Number(draft.replace(',', '.'));
    if (Number.isNaN(n) || n < 0 || n > max) {
      setState('error');
      setErrCode(n > max ? 'SCORE_EXCEEDS_MAX' : 'INVALID');
      return;
    }
    if (current && Number(current.score) === n) return;
    save((old) => gradeManual(instanceId, problem.id, n, old));
  };

  const toggleCriterion = (cid) => {
    const selected = new Set(current?.criteria ?? []);
    selected.has(cid) ? selected.delete(cid) : selected.add(cid);
    save((old) => gradeRubric(instanceId, problem.id, [...selected], old));
  };

  return (
    <div className={`gr-problem ${state === 'saving' ? 'is-active' : ''}`}>
      <div className="gr-problem__head">
        <span className="gr-problem__idx u-num">{String(problem.order).padStart(2, '0')}</span>
        <span>{problem.name}</span>
        <span className="gr-problem__score">
          {rubric.length ? (
            <span className="u-num">{current ? formatScore(current.score) : '—'}</span>
          ) : (
            <Input
              aria-label={t('problem.scoreFor', { name: problem.name })}
              inputMode="decimal"
              value={draft}
              disabled={disabled}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitManual}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              placeholder="—"
            />
          )}
          <span className="gr-problem__max">/ {formatScore(max)}</span>
        </span>
      </div>

      {rubric.length > 0 && (
        <ul className="gr-criteria">
          {rubric.map((c) => (
            <li key={c.id}>
              <Checkbox
                label={c.description}
                checked={Boolean(current?.criteria?.includes(c.id))}
                disabled={disabled || state === 'saving'}
                onChange={() => toggleCriterion(c.id)}
              />
              <span className="u-muted u-num">+{formatScore(c.score)}</span>
            </li>
          ))}
        </ul>
      )}

      <span className={`gr-problem__state is-${state}`} role={state === 'error' ? 'alert' : undefined}>
        {state === 'error' ? tc(`errors.${errCode}`, { defaultValue: errCode }) : t(`problem.state.${state}`)}
      </span>
    </div>
  );
}
