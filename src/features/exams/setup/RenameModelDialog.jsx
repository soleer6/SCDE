import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Field, Input, useToast } from '../../../ui';
import { updateModel } from '../api.js';

export default function RenameModelDialog({ model, onClose, onSaved }) {
  const { t } = useTranslation('exams');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const [label, setLabel] = useState(model.label);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const busy = useRef(false);
  const value = label.trim();
  const valid = /^[A-Za-z0-9]{1,10}$/.test(value);
  const locked = error?.code === 'PERMISSION_DENIED' || error?.code === 'COURSE_ARCHIVED' || error?.status === 404;
  const message = error && (error.code === 'VALIDATION_ERROR'
    ? t('setup.structure.labelRules')
    : t(`setup.errors.${error.code}`, { defaultValue: tc(`errors.${error.code}`, { defaultValue: tc('errors.INTERNAL_ERROR') }) }));
  const close = useCallback(() => { if (!busy.current) onClose(); }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy.current || locked || !valid || value === model.label) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const saved = await updateModel(model.model_id, { label: value });
      toast.success(t('setup.structure.modelRenamed'));
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <Dialog open title={t('setup.structure.renameTitle', { label: model.label })} onClose={close}>
      <form className="ui-stack" onSubmit={submit}>
        <Field label={t('setup.structure.label')} hint={t('setup.structure.labelRules')} error={message || (label && !valid ? t('setup.structure.labelRules') : null)}>
          {(id) => <Input id={id} value={label} maxLength={10} autoFocus disabled={pending || locked} onChange={(e) => { setLabel(e.target.value); setError(null); }} />}
        </Field>
        <div className="ui-row">
          <Button onClick={close} disabled={pending}>{tc('cancel')}</Button>
          <Button type="submit" variant="solid" loading={pending} disabled={locked || !valid || value === model.label}>{t('setup.structure.rename')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
