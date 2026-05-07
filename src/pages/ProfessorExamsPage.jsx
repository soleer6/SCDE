import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getStatusMeta } from '../api/mockData';
import { getExamsBySubject } from '../services/examService.js';
import './ProfessorExamsPage.css';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

function StatusBadge({ status }) {
    const { t } = useTranslation();
    const meta = getStatusMeta(status);
    return (
        <span
            className="status-badge"
            style={{ color: meta.color, background: meta.bg }}
        >
            {t(`status.${status}`)}
        </span>
    );
}

function ExamCard({ exam, subjectCode }) {
    const createdAt = exam.created_at || (exam.date ? exam.date + 'T' + (exam.time || '00:00:00') : null);
    const date = createdAt ? new Date(createdAt) : null;
    const dateStr = date
        ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    return (
        <Link
            to={`/professor/exams/${exam.id}`}
            className="exam-card"
            state={{ subjectCode }}
            aria-label={`Ver instancias de ${exam.name}`}
        >
            <div className="exam-card__left">
                <div className="exam-card__date-box">
                    <span className="exam-card__day">
                        {date ? date.toLocaleDateString('es-ES', { day: '2-digit' }) : '—'}
                    </span>
                    <span className="exam-card__month">
                        {date ? date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') : '—'}
                    </span>
                </div>
            </div>

            <div className="exam-card__body">
                <h3 className="exam-card__name">{exam.name}</h3>
                <p className="exam-card__meta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {dateStr}
                </p>
            </div>

            <div className="exam-card__right">
                {exam.status && <StatusBadge status={exam.status} />}
                <svg className="exam-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </div>
        </Link>
    );
}

export default function ProfessorExamsPage() {
    const { t } = useTranslation();
    const { code } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // In real API mode, subjectId (UUID) is passed via router state from ProfessorSubjectsPage.
    // In mock mode, subjectId is the mock subject id (e.g. 'mock-sub-1') from router state,
    // or we fall back to looking it up by code to handle direct URL navigation.
    const subjectIdFromState = location.state?.subjectId;
    const subjectId = subjectIdFromState
        ?? (USE_MOCK ? user?.subjects?.find((s) => s.code === code)?.id : null)
        ?? code;

    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // In mock mode fall back to user.subjects; in real mode subjectId is a UUID
    const subject = USE_MOCK
        ? user?.subjects?.find((s) => s.code === code)
        : { code, name: code, id: subjectId };

    useEffect(() => {
        getExamsBySubject(subjectId)
            .then(setExams)
            .catch((err) => setError(err.message || 'Error cargando exámenes'))
            .finally(() => setLoading(false));
    }, [subjectId]);

    if (loading) return <div className="exams-page"><p style={{ padding: '2rem' }}>Cargando exámenes…</p></div>;
    if (error) return <div className="exams-page"><p style={{ padding: '2rem', color: 'red' }}>{error}</p></div>;

    if (USE_MOCK && !subject) {
        return (
            <div className="not-found-page">
                <p>Asignatura <strong>{code}</strong> no encontrada.</p>
                <button className="btn-back" onClick={() => navigate('/professor/subjects')}>
                    ← {t('common.back')}
                </button>
            </div>
        );
    }

    return (
        <div className="exams-page">
            {/* Breadcrumb */}
            <nav className="breadcrumb" aria-label="Navegación">
                <Link to="/professor/subjects" className="breadcrumb__item">{t('professor.subjects.title').split(' ').pop()}</Link>
                <span className="breadcrumb__sep" aria-hidden="true">›</span>
                <span className="breadcrumb__item breadcrumb__item--active">{subject.name}</span>
            </nav>

            {/* Hero */}
            <div className="exams-page__hero">
                <div>
                    <p className="exams-page__code">{code}</p>
                    <h1 className="exams-page__title">{subject.name}</h1>
                    {subject.semester && (
                        <p className="exams-page__meta">
                            {t('common.semester')} {subject.semester}
                            {subject.year ? ` · ${subject.year}` : ''}
                        </p>
                    )}
                </div>
                <div className="subject-page__stats">
                    <div className="stat-card">
                        <span className="stat-card__value">{exams.length}</span>
                        <span className="stat-card__label">{t('professor.exams.title')}</span>
                    </div>
                </div>
            </div>

            {/* Exam list */}
            {exams.length === 0 ? (
                <div className="empty-state">
                    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
                        <circle cx="32" cy="32" r="30" fill="#f0f4ff" />
                        <rect x="16" y="14" width="32" height="36" rx="3" fill="white" stroke="#a0b4d8" strokeWidth="2" />
                        <line x1="22" y1="24" x2="42" y2="24" stroke="#a0b4d8" strokeWidth="2" strokeLinecap="round" />
                        <line x1="22" y1="31" x2="42" y2="31" stroke="#a0b4d8" strokeWidth="2" strokeLinecap="round" />
                        <line x1="22" y1="38" x2="34" y2="38" stroke="#a0b4d8" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <p>{t('professor.exams.empty')}</p>
                </div>
            ) : (
                <div className="exam-list">
                    {exams.map((exam) => (
                        <ExamCard key={exam.id} exam={exam} subjectCode={code} />
                    ))}
                </div>
            )}
        </div>
    );
}
