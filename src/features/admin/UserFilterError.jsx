import { useTranslation } from 'react-i18next';
import { Button, ErrorState } from '../../ui';
import { USER_FILTER_KEYS } from './user-filters.js';

export default function UserFilterError({ error, onRetry }) {
  const { t } = useTranslation('admin');
  if (error.code !== 'INVALID_FILTER') return <ErrorState error={error} onRetry={onRetry} />;
  // Filter errors contain human messages, not symbolic field codes. Only expose
  // our localized field labels, never treat arbitrary server text as i18n keys.
  return <div role="alert">
    <p>{t('filtersInvalid')}</p>
    <ul>{USER_FILTER_KEYS.filter(key => error.fields?.[key]).map(key => <li key={key}>{t(`userFilterLabels.${key}`)}</li>)}</ul>
    {onRetry && <Button onClick={onRetry}>{t('common:retry')}</Button>}
  </div>;
}
