import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { MOCK_INSTANCES } from '../api/mockData';
import PdfViewer from '../components/PdfViewer/PdfViewer';

function getInstanceById(instanceId) {
    const id = Number(instanceId);
    for (const instances of Object.values(MOCK_INSTANCES)) {
        const found = instances.find((i) => i.id === id);
        if (found) return found;
    }
    return undefined;
}

export default function ProfessorCorrectionPage() {
    const { t } = useTranslation();
    const { instanceId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const instance = getInstanceById(instanceId);

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
                gap: '12px',
                padding: '12px 20px',
                background: '#16213e',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '34px', height: '34px', borderRadius: '8px',
                        border: '1.5px solid rgba(255,255,255,0.12)',
                        background: 'transparent', color: '#a0aec0', cursor: 'pointer',
                        fontSize: '1.1rem',
                    }}
                    aria-label={t('common.back')}
                >
                    ‹
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' }}>
                        {t('correction.title')} – {instance.firstName} {instance.lastName}
                    </h1>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#718096' }}>
                        NIA: {instance.nia}
                    </p>
                </div>
            </div>

            {/* PDF Viewer */}
            <div style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
                <PdfViewer
                    pdfUrl={instance.pdfUrl}
                    author={user?.email ?? 'profesor@uni.es'}
                    instanceId={instance.id}
                />
            </div>
        </div>
    );
}
