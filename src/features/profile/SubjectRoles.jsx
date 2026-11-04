import { useTranslation } from 'react-i18next';
import { useApi } from '../../lib/hooks.js';
import { Records } from '../admin/components.jsx';
import { getSubjectRoles } from './api.js';
import './profile.css';

export default function SubjectRoles() {
  const { t } = useTranslation('profile');
  const state = useApi(getSubjectRoles);
  return <section className="profile-subjects" aria-label={t('subjects')}>
    <h2 className="ui-h2">{t('subjects')}</h2>
    <p className="u-muted">{t('activeCourse')}</p>
    <Records focusError state={state} emptyTitle={t('noSubjects')} emptyBody={t('activeCourse')} columns={[
      { key: 'code', header: t('code') },
      { key: 'name', header: t('subject') },
      { key: 'role', header: t('role'), render: row => t(`roles.${row.role}`, { defaultValue: row.role }) },
      { key: 'group_label', header: t('group'), render: row => row.group_label || '—' },
    ]} />
  </section>;
}
