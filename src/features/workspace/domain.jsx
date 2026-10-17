/* Domain UI shared by the core-flow features (workspace, exams, grading,
 * results, reviews). Built only from src/ui primitives. */
import { useTranslation } from 'react-i18next';
import { Badge, StatusRail } from '../../ui';
import { formatScore, toNumber } from '../../lib/format.js';
import { LIFECYCLE, PASS_MARK } from './model.js';
import './domain.css';

/* STYLE_GUIDE §4 */
const TONE = {
  ASSEMBLING: 'steel', RECEIVED: 'steel', QUEUED: 'steel',
  PENDING_GRADING: 'gold', GRADED: 'green', PUBLISHED: 'green',
  IN_REVIEW: 'gold', PENDING_REVIEW: 'gold', FINALIZED: undefined, ARCHIVED: undefined,
};

export function StatusBadge({ status }) {
  const { t } = useTranslation();
  return <Badge tone={TONE[status]}>{t(`status.${status}`, { defaultValue: status })}</Badge>;
}

export function RoleBadge({ role }) {
  const { t } = useTranslation();
  return (
    <Badge plain tone={role === 'STUDENT' ? undefined : 'gold'}>
      {t(`roles.${role}`, { defaultValue: role })}
    </Badge>
  );
}

/** Instance lifecycle as a sequence rail. PENDING_REVIEW is shown on the IN_REVIEW step. */
export function LifecycleRail({ status, compact }) {
  const { t } = useTranslation();
  const current = status === 'PENDING_REVIEW' ? 'IN_REVIEW' : status === 'ARCHIVED' ? 'FINALIZED' : status;
  const steps = (compact ? LIFECYCLE.slice(3) : LIFECYCLE).map((k) => ({ key: k, label: t(`status.${k}`) }));
  return <StatusRail steps={steps} current={current} label="Lifecycle" />;
}

/** Big serif score. max optional ("7,5 / 10"). Colour only carries pass/fail. */
export function Score({ value, max, size = 'md', neutral }) {
  const n = toNumber(value);
  const tone = neutral || n === null || max ? '' : n >= PASS_MARK ? 'is-pass' : 'is-fail';
  return (
    <span className={`dm-score dm-score--${size} ${tone}`}>
      {formatScore(value)}
      {max != null && <span className="dm-score__max"> / {formatScore(max)}</span>}
    </span>
  );
}

/** Thin progress line (graded / total). */
export function Progress({ done, total, label }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="dm-progress" title={label}>
      <span className="dm-progress__bar">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="dm-progress__txt u-num">
        {done}/{total}
      </span>
    </div>
  );
}
