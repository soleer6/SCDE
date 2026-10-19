import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAction } from '../../../lib/hooks.js';
import { Button, Dialog, Field, Input, useToast } from '../../../ui';
import { createExam } from '../api.js';

/** POST /subjects/{id}/exams/ then go straight to the setup page. */
export default function NewExamDialog({ subjectId, open, onClose }) {
  const { t } = useTranslation('exams');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const create = useAction(() => createExam(subjectId, { name: name.trim(), ...(date ? { date: new Date(date).toISOString() } : {}) }));

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim() || create.pending) return;
    try {
      const exam = await create.run();
      toast.success(t('create.created'));
      navigate(`/exams/${exam.id}/setup`);
    } catch (err) {
      toast.error(tc(`errors.${err.code}`, { defaultValue: err.code }));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('create.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="solid" onClick={submit} disabled={!name.trim()} loading={create.pending}>
            {t('create.submit')}
          </Button>
        </>
      }
    >
      <form className="ui-stack" onSubmit={submit}>
        <Field label={t('create.name')}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('create.namePlaceholder')} autoFocus />}</Field>
        <Field label={t('create.date')}>{(id) => <Input id={id} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      </form>
    </Dialog>
  );
}
