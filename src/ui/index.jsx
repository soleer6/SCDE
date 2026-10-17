/* Shared UI primitives. Import from 'src/ui' only:
 *   import { Button, Panel, PageHeader } from '../../ui';
 * Features compose these; they do not restyle .ui-* classes.
 */
import { cloneElement, isValidElement, useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './ui.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ---------------- Typography ---------------- */

export function Eyebrow({ children, className, as: Tag = 'p' }) {
  return <Tag className={cx('ui-eyebrow', className)}>{children}</Tag>;
}

export function PageHeader({ eyebrow, title, lede, actions, crumbs }) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header__copy">
        {crumbs && <Crumbs items={crumbs} />}
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="ui-h1">{title}</h1>
        {lede && <p className="ui-lede">{lede}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  );
}

/** items: [{ label, to? }] — last item is the current page. */
export function Crumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="ui-crumbs">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} aria-current={last ? 'page' : undefined}>
              {item.to && !last ? <Link to={item.to}>{item.label}</Link> : item.label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ---------------- Actions ---------------- */

/** variant: 'default' | 'primary' | 'solid' | 'danger' | 'ghost' */
export function Button({
  variant = 'default',
  size,
  block,
  loading,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx(
        'ui-btn',
        variant !== 'default' && `ui-btn--${variant}`,
        size === 'sm' && 'ui-btn--sm',
        block && 'ui-btn--block',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="ui-loader__bar" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/** A router link rendered as a button. */
export function ButtonLink({ to, variant = 'default', size, className, children, ...rest }) {
  return (
    <Link
      to={to}
      className={cx('ui-btn', variant !== 'default' && `ui-btn--${variant}`, size === 'sm' && 'ui-btn--sm', className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function TextLink({ to, children, ...rest }) {
  return (
    <Link to={to} className="ui-textlink" {...rest}>
      {children}
    </Link>
  );
}

/* ---------------- Forms ---------------- */

/** Wraps a control with label/hint/error. Pass a render function to get the id. */
export function Field({ label, hint, error, children, className }) {
  const id = useId();
  const descId = `${id}-desc`;
  const described = error || hint ? descId : undefined;
  let control = typeof children === 'function' ? children(id, { 'aria-describedby': described, 'aria-invalid': error ? true : undefined }) : children;
  // Link hint/error to the control automatically (callers don't have to).
  if (isValidElement(control) && described && !control.props['aria-describedby']) {
    control = cloneElement(control, { 'aria-describedby': described, 'aria-invalid': error ? true : control.props['aria-invalid'] });
  }
  return (
    <div className={cx('ui-field', error && 'ui-field--invalid', className)}>
      {label && (
        <label className="ui-field__label" htmlFor={id}>
          {label}
        </label>
      )}
      {control}
      {error ? (
        <span className="ui-field__error" id={descId} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="ui-field__hint" id={descId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }) {
  return <input className={cx('ui-input', className)} {...rest} />;
}

export function Select({ className, options, children, ...rest }) {
  return (
    <select className={cx('ui-select', className)} {...rest}>
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  );
}

export function Textarea({ className, ...rest }) {
  return <textarea className={cx('ui-textarea', className)} {...rest} />;
}

export function Checkbox({ label, ...rest }) {
  return (
    <label className="ui-checkbox">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/* ---------------- Containers ---------------- */

export function Panel({ title, actions, children, flush, className, as: Tag = 'section' }) {
  return (
    <Tag className={cx('ui-panel', flush && 'ui-panel--flush', className)}>
      {(title || actions) && (
        <div className="ui-panel__head">
          {title && <h2 className="ui-panel__title">{title}</h2>}
          {actions && <div className="ui-row">{actions}</div>}
        </div>
      )}
      <div className="ui-panel__body">{children}</div>
    </Tag>
  );
}

/** tone: 'gold' | 'green' | 'rust' | 'steel' | undefined */
export function Badge({ tone, plain, children, title }) {
  return (
    <span className={cx('ui-badge', tone && `ui-badge--${tone}`, plain && 'ui-badge--plain')} title={title}>
      {children}
    </span>
  );
}

/** stats: [{ label, value, tone? }] */
export function Stats({ items }) {
  return (
    <dl className="ui-stats">
      {items.map((s) => (
        <div key={s.label} className={cx('ui-stat', s.tone && `ui-stat--${s.tone}`)}>
          <dt>{s.label}</dt>
          <dd>{s.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** items: [{ label, value }] */
export function KeyValue({ items }) {
  return (
    <dl className="ui-kv">
      {items.map((it) => (
        <div key={it.label} style={{ display: 'contents' }}>
          <dt>{it.label}</dt>
          <dd>{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Generic data table.
 * columns: [{ key, header, render?(row), align?: 'num', width? }]
 */
export function DataTable({ columns, rows, rowKey = 'id', onRowClick, empty, caption }) {
  if (!rows?.length && empty) return empty;
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        {caption && <caption className="u-sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'num' ? 'is-num' : undefined} style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[rowKey]}
              className={onRowClick ? 'is-clickable' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter') onRowClick(row);
                    }
                  : undefined
              }
            >
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'num' ? 'is-num' : undefined}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sequence indicator. steps: [{ key, label }], current: key. Use ONLY for real sequences. */
export function StatusRail({ steps, current, numbered = true, label }) {
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="ui-rail" aria-label={label}>
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={cx(i < idx && 'is-done', i === idx && 'is-now')}
          aria-current={i === idx ? 'step' : undefined}
        >
          {numbered && <span className="ui-rail__idx">{String(i + 1).padStart(2, '0')}</span>}
          {s.label}
        </li>
      ))}
    </ol>
  );
}

export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="ui-tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count != null && <span className="u-muted"> {t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- States ---------------- */

export function Loader({ label, page }) {
  const { t } = useTranslation('common');
  return (
    <div className={cx('ui-loader', page && 'ui-loader--page')} role="status">
      <span className="ui-loader__bar" aria-hidden="true" />
      {label ?? t('loading')}
    </div>
  );
}

export function Skeleton({ width = '100%', height }) {
  return <span className="ui-skeleton" style={{ width, height }} aria-hidden="true" />;
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="ui-empty">
      <p className="ui-empty__title">{title}</p>
      {body && <p className="ui-empty__body">{body}</p>}
      {action}
    </div>
  );
}

/** Renders an ApiError (or any Error) with a translated message and a retry. */
export function ErrorState({ error, onRetry, title }) {
  const { t } = useTranslation('common');
  const code = error?.code || 'UNKNOWN';
  return (
    <div className="ui-empty ui-error" role="alert">
      <p className="ui-empty__title">{title ?? t('error.title')}</p>
      <p className="ui-empty__body">{t(`errors.${code}`, { defaultValue: t('errors.UNKNOWN') })}</p>
      <span className="ui-error__code">{code}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}

/* ---------------- Dialog ---------------- */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, title, onClose, children, footer }) {
  const { t } = useTranslation('common');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Tab' && ref.current) {
        // Focus trap: keep Tab / Shift+Tab inside the dialog.
        const items = [...ref.current.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ui-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="ui-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="ui-dialog__head">
          <h2 className="ui-panel__title">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('close')}>
            ✕
          </Button>
        </div>
        <div className="ui-dialog__body">{children}</div>
        {footer && <div className="ui-dialog__foot">{footer}</div>}
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { useToast, ToastProvider } from './toast.jsx';
