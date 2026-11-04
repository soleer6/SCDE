import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnnotationRead } from './useAnnotationRead.js';
import { useSaver } from './useSaver.js';
import { Button, ErrorState, Textarea, useToast } from '../../ui';
import { createAnnotation, deleteAnnotation, listAnnotations, readAnnotationPayload, updateAnnotation } from './api.js';

/** Text comments tied to one problem (RF-10.1/10.2/10.3): every own record is editable;
 *  comments by other teachers are shown read-only. Saving an existing note empty removes it.
 *  They are TEXT annotations with problem_id, so the page-level layers and the general comment ignore them. */
export default function ProblemNote({ instanceId, problem, canEdit, currentUserId, register }) {
  const [drafts, setDrafts] = useState({});
  const scope = JSON.stringify([instanceId, problem.id, currentUserId]);
  const notes = useAnnotationRead(async () => {
    const list = (await listAnnotations(instanceId)).filter((a) => a.annotation_type === 'TEXT' && a.problem_id === problem.id);
    return await Promise.all(list.map(async (a) => ({ ...a, text: await readAnnotationPayload(a) })));
  }, scope);

  if (notes.error) return <ErrorState error={notes.error} onRetry={notes.reload} />;
  if (notes.loading) return null;
  const all = notes.data ?? [];
  const own = canEdit ? all.filter((a) => a.author_id === currentUserId) : [];
  const others = all.filter((a) => !own.includes(a));
  const editors = own.length ? own : [null];
  if (!canEdit && !others.length) return null;

  return (
    <div className="gr-note">
      {others.map((a) => (
        <p key={a.id} className="gr-note__other">
          <span className="u-muted">{a.author_email}: </span>
          {a.text}
        </p>
      ))}
      {canEdit && editors.map((a, index) => {
        const draftKey = JSON.stringify([scope, a?.id ?? 'new']);
        return <OwnNote key={draftKey} saverKey={`note:${draftKey}`} register={register} instanceId={instanceId} problem={problem} own={a}
          suffix={editors.length > 1 ? ` (${index + 1})` : ''}
          text={drafts[draftKey] ?? a?.text ?? ''}
          onChange={(value) => setDrafts((prev) => ({ ...prev, [draftKey]: value }))}
          onSaved={() => {
            setDrafts((prev) => {
              const next = { ...prev };
              delete next[draftKey];
              return next;
            });
            notes.reload();
          }} onReload={notes.reload} />;
      })}
    </div>
  );
}

function OwnNote({ saverKey, register, instanceId, problem, own, suffix, text, onChange, onSaved, onReload }) {
  const { t } = useTranslation('grading');
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const changed = text.trim() !== (own?.text ?? '').trim();

  const inflight = useRef(null);

  const save = (quiet = false) => {
    const run = doSave(quiet);
    inflight.current = run;
    return run.finally(() => {
      if (inflight.current === run) inflight.current = null;
    });
  };

  useSaver(register, saverKey, async () => {
    if (inflight.current) return inflight.current;
    if (!changed || (!own && !text.trim())) return true;
    return save(true);
  });

  const doSave = async (quiet) => {
    setSaving(true);
    try {
      const value = text.trim();
      if (own && !value) await deleteAnnotation(own.id);
      else if (own) await updateAnnotation(own.id, { payload: value });
      else await createAnnotation(instanceId, { annotation_type: 'TEXT', payload: value, problem_id: problem.id, page_number: 1, x: 0, y: 0 });
      if (!quiet) toast.success(t(own && !value ? 'note.removed' : 'note.saved'));
      onSaved();
      return true;
    } catch (e) {
      toast.error(t('note.error'));
      if (e.status === 403 || e.status === 404) onReload();
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        disabled={saving}
        placeholder={t('note.placeholder')}
        aria-label={t('note.label', { name: problem.name }) + suffix}
        rows={2}
      />
      <Button size="sm" variant="ghost" onClick={() => save()} disabled={!changed || (!own && !text.trim())} loading={saving}>
        {t('note.save', { name: problem.name })}{suffix}
      </Button>
    </>
  );
}
