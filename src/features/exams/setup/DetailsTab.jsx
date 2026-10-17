import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAction } from '../../../lib/hooks.js';
import { Button, Checkbox, Dialog, Field, Input, Panel, useToast } from '../../../ui';
import { deleteExam, updateExam } from '../api.js';

/* Keys of Exam.student_permissions (apps/exams/models/exams.py DEFAULT_STUDENT_PERMISSIONS). */
const STUDENT_PERMS = ['can_view_pages', 'can_view_annotations', 'can_view_rubric', 'can_view_grade_breakdown', 'can_download_pages', 'can_view_pages_after_review'];

const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export default function DetailsTab({ exam, onSaved }) {
  const { t } = useTranslation('exams');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(exam.name);
  const [date, setDate] = useState(toLocal(exam.date));
  const [perms, setPerms] = useState(exam.student_permissions ?? {});
  const [confirm, setConfirm] = useState(false);
  const save = useAction(() => updateExam(exam.id, { name: name.trim(), date: date ? new Date(date).toISOString() : null, student_permissions: perms }));
  const remove = useAction(() => deleteExam(exam.id));

  const onSave = async () => {
    try {
      await save.run();
      toast.success(t('setup.details.saved'));
      onSaved();
    } catch (e) {
      toast.error(tc(`errors.${e.code}`, { defaultValue: e.code }));
    }
  };
  const onDelete = async () => {
    try {
      await remove.run();
      toast.success(t('setup.details.deleted'));
      navigate(`/subjects/${exam.subject_id}`, { replace: true });
    } catch (e) {
      setConfirm(false);
      toast.error(t(`setup.errors.${e.code}`, { defaultValue: tc(`errors.${e.code}`, { defaultValue: e.code }) }));
    }
  };

  return (
    <div className="setup-grid">
      <Panel title={t('setup.details.title')}>
        <div className="ui-stack">
          <Field label={t('setup.details.name')} error={save.error?.fieldCode?.('name') ? tc(`errors.${save.error.fieldCode('name')}`) : null}>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label={t('setup.details.date')}>{(id) => <Input id={id} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        </div>
      </Panel>
      <Panel title={t('setup.details.studentPerms')}>
        <div className="ui-stack">
          <p className="u-muted">{t('setup.details.studentPermsHelp')}</p>
          {STUDENT_PERMS.map((k) => (
            <Checkbox key={k} label={t(`setup.studentPerms.${k}`)} checked={Boolean(perms[k])} onChange={() => setPerms((p) => ({ ...p, [k]: !p[k] }))} />
          ))}
        </div>
      </Panel>
      <div className="setup-actions">
        <Button variant="danger" onClick={() => setConfirm(true)}>
          {t('setup.details.delete')}
        </Button>
        <Button variant="solid" onClick={onSave} loading={save.pending} disabled={!name.trim()}>
          {t('setup.details.save')}
        </Button>
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('setup.details.deleteTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {tc('cancel')}
            </Button>
            <Button variant="danger" onClick={onDelete} loading={remove.pending}>
              {t('setup.details.delete')}
            </Button>
          </>
        }
      >
        <p>{t('setup.details.deleteBody', { name: exam.name })}</p>
      </Dialog>
    </div>
  );
}
