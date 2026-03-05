import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getExamsBySubject, getStatusMeta } from '../api/mockData';
import './ProfessorExamsPage.css';

function StatusBadge({ status }) {
    const meta = getStatusMeta(status);
    return (
        <span
            className="status-badge"
            style={{ color: meta.color, background: meta.bg }}
        >
            {meta.label}
        </span>
    );
}

function ExamCard({ exam, subjectCode }) {
    const date = new Date(exam.date + 'T' + exam.time);
    const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <Link
            to={`/profesor/examenes/${exam.id}`}
            className="exam-card"
            state={{ subjectCode }}
            aria-label={`Ver instancias de ${exam.name}`}
        >
            <div className="exam-card__left">
                <div className="exam-card__date-box">
                    <span className="exam-card__day">
                        {date.toLocaleDateString('es-ES', { day: '2-digit' })}
                    </span>
                    <span className="exam-card__month">
                        {date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}
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
                    {dateStr} · {exam.time}
                </p>
            </div>

            <div className="exam-card__right">
                <StatusBadge estado={exam.status} />
                <svg className="exam-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </div>
        </Link>
    );
}

export default function ProfessorExamsPage() {
    const { code } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    // Find subject info from user's enrolled subjects
    const subject = user?.subjects?.find((s) => s.code === code);
    const exams = getExamsBySubject(code);

    if (!subject) {
        return (
            <div className="not-found-page">
                <p>Asignatura <strong>{code}</strong> no encontrada.</p>
                <button className="btn-back" onClick={() => navigate('/profesor/asignaturas')}>
                    ← Volver a mis asignaturas
                </button>
            </div>
        );
    }

    return (
        <div className="exams-page">
            {/* Breadcrumb */}
            <nav className="breadcrumb" aria-label="Navegación">
                <Link to="/profesor/asignaturas" className="breadcrumb__item">Asignaturas</Link>
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
                            Cuatrimestre {subject.semester}
                            {subject.year ? ` · ${subject.year}` : ''}
                        </p>
                    )}
                </div>
                <div className="subject-page__stats">
                    <div className="stat-card">
                        <span className="stat-card__value">{exams.length}</span>
                        <span className="stat-card__label">Exámenes</span>
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
                    <p>No hay exámenes para esta asignatura.</p>
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
