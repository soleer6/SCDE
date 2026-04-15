import { useState, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useTranslation } from 'react-i18next';

import AnnotationToolbar from './AnnotationToolbar';
import PdfCanvas from './PdfCanvas';
import useAnnotations from '../../hooks/useAnnotations';
import './PdfViewer.css';

// Point react-pdf to the bundled worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

export default function PdfViewer({ pdfUrl, author, instanceId }) {
    const { t } = useTranslation();
    const [numPages, setNumPages] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageWidth, setPageWidth] = useState(null);

    // Annotation state
    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState('#e53e3e');
    const [width, setWidth] = useState(4);

    // Save state
    const [showCommentBox, setShowCommentBox] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const {
        getStrokes, addStroke, clearPage, undo,
        textComment, setTextComment, loadAnnotations, saveAnnotations
    } = useAnnotations(instanceId, author);

    useEffect(() => {
        loadAnnotations();
    }, [loadAnnotations]);

    const handleSave = () => {
        setIsSaving(true);
        saveAnnotations();
        setTimeout(() => setIsSaving(false), 1500);
    };

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setCurrentPage(1);
    };

    /* Measure container width once the page wrapper mounts */
    const pageWrapperRef = useCallback((node) => {
        if (node) setPageWidth(node.clientWidth);
    }, []);

    const handleStrokeComplete = (page, points, strokeColor, strokeWidth, activeTool) => {
        if (activeTool === 'eraser') return; // eraser handled via canvas composite op
        addStroke(page, points, strokeColor, strokeWidth);
    };

    const goTo = (delta) => {
        setCurrentPage((p) => Math.min(Math.max(p + delta, 1), numPages ?? 1));
    };

    return (
        <div className="pdf-viewer">
            <AnnotationToolbar
                tool={tool} onToolChange={setTool}
                color={color} onColorChange={setColor}
                width={width} onWidthChange={setWidth}
                onUndo={() => undo(currentPage)}
                onClearPage={() => clearPage(currentPage)}
                onToggleComment={() => setShowCommentBox(p => !p)}
                onSave={handleSave}
                isSaving={isSaving}
            />

            {showCommentBox && (
                <div style={{ padding: '12px', background: '#16213e', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <textarea
                        value={textComment}
                        onChange={(e) => setTextComment(e.target.value)}
                        placeholder={t('correction.comment')}
                        style={{
                            width: '100%', minHeight: '80px', background: '#0f0f23',
                            color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '6px', padding: '8px', fontFamily: 'inherit', resize: 'vertical'
                        }}
                    />
                </div>
            )}

            <div className="pdf-main">
                <div className="pdf-page-wrapper" ref={pageWrapperRef}>
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="pdf-loading">{t('common.loading')}</div>}
                        error={<div className="pdf-error">{t('correction.pdfError')}</div>}
                    >
                        <div className="pdf-page-container">
                            <Page
                                pageNumber={currentPage}
                                width={pageWidth ?? undefined}
                                renderAnnotationLayer={false}
                                renderTextLayer={false}
                            />
                            <PdfCanvas
                                page={currentPage}
                                strokes={getStrokes(currentPage)}
                                tool={tool}
                                color={color}
                                width={width}
                                onStrokeComplete={handleStrokeComplete}
                            />
                        </div>
                    </Document>
                </div>
            </div>

            {numPages && (
                <div className="pdf-nav">
                    <button
                        className="pdf-nav__btn"
                        onClick={() => goTo(-1)}
                        disabled={currentPage <= 1}
                        aria-label={t('correction.prevPage')}
                    >
                        ‹
                    </button>
                    <span className="pdf-nav__info">
                        {t('correction.pageOf', { current: currentPage, total: numPages })}
                    </span>
                    <button
                        className="pdf-nav__btn"
                        onClick={() => goTo(1)}
                        disabled={currentPage >= numPages}
                        aria-label={t('correction.nextPage')}
                    >
                        ›
                    </button>
                </div>
            )}
        </div>
    );
}
