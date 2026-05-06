import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
    getInstancesByExam,
    downloadInstancePdf,
} from '../services/instanceService.js';
import { preloadAnnotationsToLocalStorage } from '../services/annotationService.js';
import PdfViewer from '../components/PdfViewer/PdfViewer';
import './StudentResultPage.css';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

const MOCK_INSTANCE = {
    id: 'mock-inst-2',
    examId: 'mock-exam-1',
    firstName: 'Elena',
    lastName: 'R.',
    email: 'elena.r@estudiante.uni.es',
    status: 'CORRECTED',
    grade: 7.5,
    hasIssues: false,
};

function GradePill({ grade }) {
    if (grade === null || grade === undefined) {
        return <span className="result-grade-pill result-grade-pill--empty">—</span>;
    }
    const isPassing = grade >= 5;
    return (
        <span className={`result-grade-pill ${isPassing ? 'result-grade-pill--pass' : 'result-grade-pill--fail'}`}>
            {grade.toFixed(1)}
        </span>
    );
}

export default function StudentResultPage() {
    const { t } = useTranslation();
    const { examId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const viewerRef = useRef(null);

    const [instance, setInstance] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [textComment, setTextComment] = useState('');

    useEffect(() => {
        let blobUrl = null;

        async function load() {
            try {
                if (USE_MOCK) {
                    setInstance(MOCK_INSTANCE);
                    setLoading(false);
                    return;
                }

                // Find the student's own instance within this exam
                const instances = await getInstancesByExam(examId);
                const mine = instances.find(
                    (inst) => inst.email === user?.email
                );

                if (!mine) {
                    setError(t('student.result.noInstance'));
                    setLoading(false);
                    return;
                }

                // Load PDF and annotations in parallel
                const [blob] = await Promise.all([
                    downloadInstancePdf(mine.id).catch(() => null),
                    preloadAnnotationsToLocalStorage(mine.id, user?.email),
                ]);

                // Read text comment from localStorage (written by preload)
                const stored = localStorage.getItem(`scde_annotations_${mine.id}`);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed.textComment) setTextComment(parsed.textComment);
                    } catch (_) { /* ignore */ }
                }

                blobUrl = blob;
                setInstance(mine);
                setPdfUrl(blob);
            } catch (err) {
                setError(err.message || 'Error cargando resultado');
            } finally {
                setLoading(false);
            }
        }

        load();

        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [examId, user?.email, t]);

    if (loading) {
        return (
            <div className="result-page result-page--loading">
                <p>{t('common.loading')}</p>
            </div>
        );
    }

    if (error || !instance) {
        return (
            <div className="result-page result-page--error">
                <p>{error || t('student.result.noInstance')}</p>
                <button className="btn-back" onClick={() => navigate(-1)}>← {t('common.back')}</button>
            </div>
        );
    }

    const statusLabel = t(`status.${instance.status}`, { defaultValue: instance.status });

    return (
        <div className="result-page">
            {/* Header */}
            <header className="result-header">
                <button
                    className="result-header__back"
                    onClick={() => navigate(-1)}
                    aria-label={t('common.back')}
                >
                    ← {t('common.back')}
                </button>

                <div className="result-header__info">
                    <h1 className="result-header__title">{t('student.result.title')}</h1>
                    <div className="result-header__meta">
                        <span className="result-header__status">{statusLabel}</span>
                        <span className="result-header__dot" aria-hidden="true">·</span>
                        <span className="result-header__grade-label">{t('student.result.grade')}</span>
                        <GradePill grade={instance.grade} />
                    </div>
                </div>
            </header>

            {/* Professor comments (if any) */}
            {textComment && (
                <div className="result-comments">
                    <p className="result-comments__label">{t('student.result.comments')}</p>
                    <p className="result-comments__text">{textComment}</p>
                </div>
            )}

            {/* PDF viewer (read-only) */}
            <div className="result-viewer-wrap">
                {pdfUrl ? (
                    <PdfViewer
                        ref={viewerRef}
                        pdfUrl={pdfUrl}
                        author={user?.email}
                        instanceId={instance.id}
                        readOnly
                    />
                ) : (
                    <div className="result-no-pdf">
                        <p>{t('student.result.noPdf')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
