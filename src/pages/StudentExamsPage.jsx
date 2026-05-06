import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getExamsBySubject } from '../services/examService.js';
import './ProfessorExamsPage.css';

function ExamCard({ exam, subjectId }) {
    const createdAt = exam.created_at || null;
    const date = createdAt ? new Date(createdAt) : null;
    const dateStr = date
        ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    return (
        <Link
            to={`/student/result/${exam.id}`}
            state={{ subjectId }}
            className="exam-card"
            aria-label={`Ver resultado de ${exam.name}`}
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
                <svg className="exam-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </div>
        </Link>
    );
}

export default function StudentExamsPage() {
    const { t } = useTranslation();
    const { subjectId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const subjectCode = location.state?.subjectCode ?? subjectId;
    const subjectName = location.state?.subjectName ?? subjectId;

    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        getExamsBySubject(subjectId)
            .then(setExams)
            .catch((err) => setError(err.message || 'Error cargando exámenes'))
            .finally(() => setLoading(false));
    }, [subjectId]);

    if (loading) return <div className="exams-page"><p style={{ padding: '2rem' }}>{t('common.loading')}</p></div>;
    if (error) return <div className="exams-page"><p style={{ padding: '2rem', color: 'red' }}>{error}</p></div>;

    return (
        <div className="exams-page">
            <nav className="breadcrumb" aria-label="Navegación">
                <Link to="/student/subjects" className="breadcrumb__item">{t('student.subjects.title').split(' ').pop()}</Link>
                <span className="breadcrumb__sep" aria-hidden="true">›</span>
                <span className="breadcrumb__item breadcrumb__item--active">{subjectName}</span>
            </nav>

            <div className="exams-page__hero">
                <div>
                    <p className="exams-page__code">{subjectCode}</p>
                    <h1 className="exams-page__title">{subjectName}</h1>
                </div>
                <div className="subject-page__stats">
                    <div className="stat-card">
                        <span className="stat-card__value">{exams.length}</span>
                        <span className="stat-card__label">{t('student.exams.title')}</span>
                    </div>
                </div>
            </div>

            {exams.length === 0 ? (
                <div className="empty-state">
                    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
                        <circle cx="32" cy="32" r="30" fill="#f0f4ff" />
                        <rect x="16" y="14" width="32" height="36" rx="3" fill="white" stroke="#a0b4d8" strokeWidth="2" />
                        <line x1="22" y1="24" x2="42" y2="24" stroke="#a0b4d8" strokeWidth="2" strokeLinecap="round" />
                        <line x1="22" y1="31" x2="42" y2="31" stroke="#a0b4d8" strokeWidth="2" strokeLinecap="round" />
                        <line x1="22" y1="38" x2="34" y2="38" stroke="#a0b4d8" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <p>{t('student.exams.empty')}</p>
                </div>
            ) : (
                <div className="exam-list">
                    {exams.map((exam) => (
                        <ExamCard key={exam.id} exam={exam} subjectId={subjectId} />
                    ))}
                </div>
            )}

            <button className="btn-back" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/student/subjects')}>
                ← {t('common.back')}
            </button>
        </div>
    );
}
