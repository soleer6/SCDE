import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { MOCK_INSTANCES, getStoredCorrection, saveStoredCorrection } from '../api/mockData';
import { getInstance, downloadInstancePdf, transitionInstance, toBackendStatus } from '../services/instanceService.js';
import { syncAnnotations, preloadAnnotationsToLocalStorage } from '../services/annotationService.js';
import PdfViewer from '../components/PdfViewer/PdfViewer';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

function getMockInstanceById(instanceId) {
    const id = Number(instanceId);
    for (const instances of Object.values(MOCK_INSTANCES)) {
        const found = instances.find((i) => i.id === id);
        if (found) return found;
    }
    return undefined;
}

function clampGrade(value) {
    const n = parseFloat(value);
    if (isNaN(n)) return null;
    return Math.min(10, Math.max(0, Math.round(n * 10) / 10));
}

export default function ProfessorCorrectionPage() {
    const { t } = useTranslation();
    const { instanceId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const pdfViewerRef = useRef(null);

    const [instance, setInstance] = useState(USE_MOCK ? getMockInstanceById(instanceId) : null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [loadingInstance, setLoadingInstance] = useState(!USE_MOCK);
    const [grade, setGrade] = useState(null);
    const [instanceStatus, setInstanceStatus] = useState('PENDING');
    const [gradeInput, setGradeInput] = useState('');
    const [isFinalizing, setIsFinalizing] = useState(false);

    // Load instance and PDF in real API mode
    useEffect(() => {
        if (USE_MOCK) {
            // Mock mode: restore from localStorage
            const stored = getStoredCorrection(instanceId);
            if (stored) {
                if (stored.grade != null) { setGrade(stored.grade); setGradeInput(String(stored.grade)); }
                if (stored.status) setInstanceStatus(stored.status);
            } else if (instance) {
                setGrade(instance.grade ?? null);
                setInstanceStatus(instance.status ?? 'PENDING');
                if (instance.grade != null) setGradeInput(String(instance.grade));
            }
            return;
        }

        // Real API mode
        Promise.all([
            getInstance(instanceId),
            downloadInstancePdf(instanceId).catch(() => null),
            preloadAnnotationsToLocalStorage(instanceId, user?.email ?? ''),
        ]).then(([inst, blobUrl]) => {
            setInstance(inst);
            setPdfUrl(blobUrl);
            if (inst) {
                setGrade(inst.grade ?? null);
                setInstanceStatus(inst.status ?? 'PENDING');
                if (inst.grade != null) setGradeInput(String(inst.grade));
            }
        }).finally(() => setLoadingInstance(false));

        return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    }, [instanceId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleGradeInputChange = (e) => {
        const raw = e.target.value;
        setGradeInput(raw);
        setGrade(clampGrade(raw));
    };

    const handleGradeBlur = () => {
        if (grade != null) setGradeInput(String(grade));
        else setGradeInput('');
    };

    const toggleStatus = useCallback(() => {
        setInstanceStatus((s) => (s === 'CORRECTED' ? 'PENDING' : 'CORRECTED'));
    }, []);

    const handleFinalize = useCallback(async () => {
        pdfViewerRef.current?.save(); // siempre guarda en localStorage

        if (USE_MOCK) {
            saveStoredCorrection(instanceId, { grade, status: instanceStatus });
        } else {
            // Sync annotations to backend
            try {
                const raw = localStorage.getItem(`scde_annotations_${instanceId}`);
                if (raw) {
                    const data = JSON.parse(raw);
                    await syncAnnotations(instanceId, data);
                }
            } catch (err) {
                console.warn('Error syncing annotations:', err);
            }
            // Transition instance status
            try {
                await transitionInstance(instanceId, toBackendStatus(instanceStatus));
            } catch (err) {
                console.warn('Error transitioning status:', err);
            }
        }

        setIsFinalizing(true);
        setTimeout(() => setIsFinalizing(false), 2000);
    }, [instanceId, grade, instanceStatus]);

    if (loadingInstance) {
        return <div style={{ padding: '2rem', color: '#a0aec0', fontFamily: 'Inter, sans-serif' }}>Cargando instancia…</div>;
    }

    if (!instance) {
        return (
            <div style={{ padding: '2rem', color: '#a0aec0', fontFamily: 'Inter, sans-serif' }}>
                <p>{t('correction.notFound', { id: instanceId })}</p>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '8px',
                        border: '1px solid #4a5568', background: 'transparent', color: '#e2e8f0',
                        cursor: 'pointer',
                    }}
                >
                    ← {t('common.back')}
                </button>
            </div>
        );
    }

    const isCorrected = instanceStatus === 'CORRECTED';

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: '#0f0f23',
            fontFamily: 'Inter, "Segoe UI", sans-serif',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '10px 20px',
                background: '#16213e',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
                flexWrap: 'wrap',
            }}>
                {/* Left: back + student info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '34px', height: '34px', borderRadius: '8px',
                            border: '1.5px solid rgba(255,255,255,0.12)',
                            background: 'transparent', color: '#a0aec0', cursor: 'pointer',
                            fontSize: '1.1rem', flexShrink: 0,
                        }}
                        aria-label={t('common.back')}
                    >
                        ‹
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
                            {t('correction.title')} – {instance.firstName} {instance.lastName}
                        </h1>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#718096' }}>
                            NIA: {instance.nia}
                        </p>
                    </div>
                </div>

                {/* Right: grade panel */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Grade input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#a0aec0', whiteSpace: 'nowrap' }}>
                            {t('correction.grade')}
                        </span>
                        <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={gradeInput}
                            onChange={handleGradeInputChange}
                            onBlur={handleGradeBlur}
                            placeholder="—"
                            style={{
                                width: '58px',
                                textAlign: 'center',
                                background: '#0f0f23',
                                color: grade == null ? '#718096' : grade >= 5 ? '#10b981' : '#f56565',
                                border: '1px solid rgba(255,255,255,0.18)',
                                borderRadius: '6px',
                                padding: '5px 6px',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                fontFamily: 'inherit',
                            }}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#4a5568' }}>{t('correction.outOf')}</span>
                    </div>

                    {/* Status toggle */}
                    <button
                        onClick={toggleStatus}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '5px 12px', borderRadius: '6px',
                            border: `1px solid ${isCorrected ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.12)'}`,
                            background: isCorrected ? 'rgba(16,185,129,0.12)' : 'transparent',
                            color: isCorrected ? '#10b981' : '#718096',
                            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {isCorrected ? (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                                {t('correction.markCorrected')}
                            </>
                        ) : (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" />
                                </svg>
                                {t('correction.markPending')}
                            </>
                        )}
                    </button>

                    {/* Finalize button */}
                    <button
                        onClick={handleFinalize}
                        style={{
                            padding: '6px 16px', borderRadius: '8px',
                            background: isFinalizing
                                ? 'rgba(16,185,129,0.2)'
                                : 'linear-gradient(135deg, #2d6be4 0%, #1a56db 100%)',
                            border: isFinalizing ? '1px solid rgba(16,185,129,0.4)' : 'none',
                            color: isFinalizing ? '#10b981' : 'white',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {isFinalizing ? `✓ ${t('correction.finalized')}` : t('correction.finalize')}
                    </button>
                </div>
            </div>

            {/* PDF Viewer */}
            <div style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
                <PdfViewer
                    ref={pdfViewerRef}
                    pdfUrl={pdfUrl ?? instance.pdfUrl}
                    author={user?.email ?? 'profesor@uni.es'}
                    instanceId={instance.id}
                />
            </div>
        </div>
    );
}
