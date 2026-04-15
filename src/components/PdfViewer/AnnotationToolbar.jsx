import { useTranslation } from 'react-i18next';

const COLORS = [
    { value: '#e53e3e', label: 'Rojo' },
    { value: '#38a169', label: 'Verde' },
    { value: '#3182ce', label: 'Azul' },
    { value: '#1a202c', label: 'Negro' },
];

const WIDTHS = [
    { value: 2, labelKey: 'correction.toolbar.thin' },
    { value: 4, labelKey: 'correction.toolbar.medium' },
    { value: 8, labelKey: 'correction.toolbar.thick' },
];

export default function AnnotationToolbar({
    tool, onToolChange,
    color, onColorChange,
    width, onWidthChange,
    onUndo, onClearPage,
    onToggleComment, onSave, isSaving
}) {
    const { t } = useTranslation();

    return (
        <div className="annotation-toolbar">
            {/* Tools */}
            <div className="toolbar-group">
                <button
                    className={`toolbar-btn ${tool === 'pen' ? 'toolbar-btn--active' : ''}`}
                    onClick={() => onToolChange('pen')}
                    title={t('correction.toolbar.pen')}
                    aria-pressed={tool === 'pen'}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 19l7-7-3.5-3.5-7 7V19h3.5z" />
                        <path d="M15.5 8.5L17 7a2 2 0 00-2.83-2.83l-1.5 1.5" />
                    </svg>
                </button>
                <button
                    className={`toolbar-btn ${tool === 'eraser' ? 'toolbar-btn--active' : ''}`}
                    onClick={() => onToolChange('eraser')}
                    title={t('correction.toolbar.eraser')}
                    aria-pressed={tool === 'eraser'}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M20 20H7L3 16l10-10 7 7-2.5 2.5" />
                        <path d="M6.5 17.5l4-4" />
                    </svg>
                </button>
            </div>

            <div className="toolbar-divider" />

            {/* Colors */}
            <div className="toolbar-group toolbar-group--colors">
                {COLORS.map((c) => (
                    <button
                        key={c.value}
                        className={`color-swatch ${color === c.value ? 'color-swatch--active' : ''}`}
                        style={{ background: c.value }}
                        onClick={() => onColorChange(c.value)}
                        title={c.label}
                        aria-label={c.label}
                        aria-pressed={color === c.value}
                    />
                ))}
            </div>

            <div className="toolbar-divider" />

            {/* Widths */}
            <div className="toolbar-group">
                {WIDTHS.map((w) => (
                    <button
                        key={w.value}
                        className={`toolbar-btn width-btn ${width === w.value ? 'toolbar-btn--active' : ''}`}
                        onClick={() => onWidthChange(w.value)}
                        title={t(w.labelKey)}
                        aria-pressed={width === w.value}
                    >
                        <span
                            className="width-preview"
                            style={{ height: `${w.value}px`, background: color }}
                        />
                    </button>
                ))}
            </div>

            <div className="toolbar-divider" />

            {/* Actions */}
            <div className="toolbar-group">
                <button
                    className="toolbar-btn"
                    onClick={onToggleComment}
                    title={t('correction.addComment')}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </button>
                <button
                    className="toolbar-btn"
                    onClick={onUndo}
                    title={t('correction.toolbar.undo')}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M3 7v6h6" />
                        <path d="M3 13A9 9 0 1 0 6 6.7L3 9" />
                    </svg>
                </button>
                <button
                    className="toolbar-btn toolbar-btn--danger"
                    onClick={onClearPage}
                    title={t('correction.toolbar.clearPage')}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                    </svg>
                </button>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
                <button
                    className={`toolbar-btn ${isSaving ? 'toolbar-btn--active' : ''}`}
                    style={isSaving ? { color: '#10b981', borderColor: '#10b981', background: 'rgba(16, 185, 129, 0.15)' } : {}}
                    onClick={onSave}
                    title={isSaving ? t('correction.saved') : t('correction.save')}
                >
                    {isSaving ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
}
