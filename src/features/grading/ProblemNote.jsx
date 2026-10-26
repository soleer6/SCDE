import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../lib/hooks.js';
import { Button, Textarea, useToast } from '../../ui';
import { createAnnotation, deleteAnnotation, listAnnotations, readAnnotationPayload, updateAnnotation } from './api.js';

/** Text comment tied to one problem (RF-10.1/10.3): each teacher keeps one of their own per problem
 *  (create, edit, remove by saving it empty); comments by other teachers are shown read-only.
 *  They are TEXT annotations with problem_id, so the page-level layers and the general comment ignore them. */
export default function ProblemNote({ instanceId, problem, canEdit, currentUserId }) {
  const notes = useApi(async () => {
    try {
      const list = (await listAnnotations(instanceId)).filter((a) => a.annotation_type === 'TEXT' && a.problem_id === problem.id);
      return await Promise.all(list.map(async (a) => ({ ...a, text: await readAnnotationPayload(a) })));
    } catch (e) {
      if (e.status === 403) return [];
      throw e;
    }
  }, [instanceId, problem.id]);

  if (notes.initialLoading || notes.error) return null;
  const all = notes.data ?? [];
  const own = canEdit ? all.find((a) => a.author_id === currentUserId) : null;
  const others = all.filter((a) => a !== own);
  if (!canEdit && !others.length) return null;

  return (
    <div className="gr-note">
      {others.map((a) => (
        <p key={a.id} className="gr-note__other">
          <span className="u-muted">{a.author_email}: </span>
          {a.text}
        </p>
      ))}
      {canEdit && <OwnNote key={own?.id ?? 'new'} instanceId={instanceId} problem={problem} own={own} onSaved={notes.reload} />}
    </div>
  );
}

function OwnNote({ instanceId, problem, own, onSaved }) {
  const { t } = useTranslation('grading');
  const toast = useToast();
  const [text, setText] = useState(own?.text ?? '');
  const [saving, setSaving] = useState(false);
  const changed = text.trim() !== (own?.text ?? '').trim();

  const save = async () => {
    setSaving(true);
    try {
      const value = text.trim();
      if (own && !value) await deleteAnnotation(own.id);
      else if (own) await updateAnnotation(own.id, { payload: value });
      else await createAnnotation(instanceId, { annotation_type: 'TEXT', payload: value, problem_id: problem.id, page_number: 1, x: 0, y: 0 });
      toast.success(t(own && !value ? 'note.removed' : 'note.saved'));
      onSaved();
    } catch (e) {
      toast.error(t('note.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('note.placeholder')}
        aria-label={t('note.label', { name: problem.name })}
        rows={2}
      />
      <Button size="sm" variant="ghost" onClick={save} disabled={!changed || (!own && !text.trim())} loading={saving}>
        {t('note.save', { name: problem.name })}
      </Button>
    </>
  );
}
