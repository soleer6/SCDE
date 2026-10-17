import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RoleBadge } from './domain.jsx';

/** Hairline grid of subjects (few, distinct items — not a record list). */
export default function SubjectGrid({ subjects }) {
  const { t } = useTranslation('workspace');
  return (
    <div className="dm-subjects">
      {subjects.map((s) => (
        <Link key={s.id} to={`/subjects/${s.id}`} className="dm-subject">
          <span className="dm-subject__code">{s.code}</span>
          <span className="dm-subject__name">{s.name}</span>
          <span className="dm-subject__meta">
            <span>
              {t('subjects.semester', { n: s.semester })}
              {s.group_label ? ` · ${s.group_label}` : ''}
            </span>
            <RoleBadge role={s.role} />
          </span>
        </Link>
      ))}
    </div>
  );
}
