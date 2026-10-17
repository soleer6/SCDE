import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui';

/** Instance-level issue_types as badges; page-level issues only set has_issues. */
export default function IssueList({ instance }) {
  const { t } = useTranslation('ingestion');
  const types = instance.issue_types ?? [];
  if (!types.length && !instance.has_issues) return <span className="u-muted">—</span>;
  return (
    <span className="in-badges">
      {types.map((x) => (
        <Badge key={x} tone="gold">
          {t(`issueTypes.${x}`, { defaultValue: x })}
        </Badge>
      ))}
      {!types.length && <Badge tone="gold">{t('issueTypes.PAGES')}</Badge>}
    </span>
  );
}
