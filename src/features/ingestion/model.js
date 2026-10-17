import { useTranslation } from 'react-i18next';

/** Feature-specific error text first (ingestion:errors.*), then common:errors.*. */
export function useErrorText() {
  const { t } = useTranslation('ingestion');
  const { t: tc } = useTranslation();
  return (e) => t(`errors.${e?.code}`, { defaultValue: tc(`errors.${e?.code}`, { defaultValue: e?.code ?? tc('errors.UNKNOWN') }) });
}

/* Page status (apps.instances.models.PageStatus) -> Badge tone (STYLE_GUIDE §4). */
export const PAGE_TONE = { PENDING_RECOGNITION: 'steel', RECOGNIZED: 'green', ORPHAN: 'gold', DISCARDED: undefined };
