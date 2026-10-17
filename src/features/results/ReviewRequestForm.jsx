import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAction } from '../../lib/hooks.js';
import { Button, Checkbox, Field, Textarea, useToast } from '../../ui';
import { submitReviewRequests } from './api.js';

/** POST /instances/{id}/review-requests/ { problems: [{ problem_id, message }] }.
 *  problem_id is only available if the backend exposes it (gap-2). */
export default function ReviewRequestForm({ inst, existing, onSent }) {
  const { t } = useTranslation('results');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const [picked, setPicked] = useState({}); // problem_id -> message
  const problems = (inst.rubric ?? inst.grades ?? []).filter((p) => p.problem_id);
  const already = new Set(existing.map((r) => r.problem_id));
  const send = useAction(() =>
    submitReviewRequests(
      inst.id,
      Object.entries(picked).map(([problem_id, message]) => ({ problem_id, message })),
    ),
  );

  if (!(inst.rubric ?? inst.grades)?.length) return <p className="u-muted">{t('review.noProblems')}</p>;
  if (!problems.length) return <p className="u-muted">{t('review.noIds')}</p>;

  const submit = async () => {
    try {
      await send.run();
      setPicked({});
      toast.success(t('review.sent'));
      onSent?.();
    } catch (e) {
      toast.error(t(`review.errors.${e.code}`, { defaultValue: tc(`errors.${e.code}`, { defaultValue: e.code }) }));
    }
  };

  return (
    <div className="ui-stack rs-form">
      <p className="u-muted">{t('review.help')}</p>
      {problems.map((p) => {
        const on = picked[p.problem_id] !== undefined;
        const done = already.has(p.problem_id);
        return (
          <div key={p.problem_id} className="rs-form__item">
            <Checkbox
              label={done ? `${p.problem_name} · ${t('review.alreadySent')}` : p.problem_name}
              checked={on || done}
              disabled={done}
              onChange={() =>
                setPicked((s) => {
                  const n = { ...s };
                  on ? delete n[p.problem_id] : (n[p.problem_id] = '');
                  return n;
                })
              }
            />
            {on && (
              <Field label={t('review.reason')}>
                {(id) => (
                  <Textarea
                    id={id}
                    value={picked[p.problem_id]}
                    onChange={(e) => setPicked((s) => ({ ...s, [p.problem_id]: e.target.value }))}
                    placeholder={t('review.reasonPlaceholder')}
                  />
                )}
              </Field>
            )}
          </div>
        );
      })}
      <Button variant="solid" onClick={submit} disabled={!Object.keys(picked).length} loading={send.pending}>
        {t('review.submit', { count: Object.keys(picked).length })}
      </Button>
    </div>
  );
}
