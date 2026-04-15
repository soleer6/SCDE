import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getExamById, getInstancesByExam, getStatusMeta } from '../api/mockData';
import './ProfessorInstancesPage.css';

function StatusBadge({ status }) {
    const { t } = useTranslation();
    const meta = getStatusMeta(status);
    return (
        <span className="status-badge" style={{ color: meta.color, background: meta.bg }}>
            {t(`status.${status}`)}
        </span>
    );
}

function GradeChip({ grade }) {
    if (grade === null || grade === undefined) {
        return <span className="grade-chip grade-chip--empty">—</span>;
    }
    const cls = grade >= 5 ? 'grade-chip--pass' : 'grade-chip--fail';
    return <span className={`grade-chip ${cls}`}>{grade.toFixed(1)}</span>;
}

function InstanceRow({ instance }) {
    const navigate = useNavigate();
    const handleClick = () => {
        navigate(`/professor/correction/${instance.id}`);
    };

    return (
        <tr
            className="instance-row"
            onClick={handleClick}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleClick()}
            role="button"
            aria-label={`Ver instancia de ${instance.firstName} ${instance.lastName}`}
        >
            <td className="instance-cell instance-cell--avatar">
                <div className="instance-avatar">
                    {instance.firstName[0]}{instance.lastName[0]}
                </div>
            </td>
            <td className="instance-cell instance-cell--name">
                <span className="instance-name">{instance.firstName} {instance.lastName}</span>
                <span className="instance-nia">NIA: {instance.nia}</span>
            </td>
            <td className="instance-cell instance-cell--status">
                <StatusBadge status={instance.status} />
            </td>
            <td className="instance-cell instance-cell--grade">
                <GradeChip grade={instance.grade} />
            </td>
            <td className="instance-cell instance-cell--action">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </td>
        </tr>
    );
}

export default function ProfessorInstancesPage() {
    const { t } = useTranslation();
    const { examId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const exam = getExamById(examId);
    const instances = getInstancesByExam(examId);

    // Recover subjectCode from router state (set by ExamCard) or fall back to searching
    const subjectCode = location.state?.subjectCode ?? '—';
    const subject = user?.subjects?.find((s) => s.code === subjectCode);

    if (!exam) {
        return (
            <div className="not-found-page">
                <p>Examen <strong>#{examId}</strong> no encontrado.</p>
                <button className="btn-back" onClick={() => navigate('/professor/subjects')}>
                    ← {t('common.back')}
                </button>
            </div>
        );
    }

    const dateStr = new Date(exam.date + 'T' + exam.time).toLocaleDateString('es-ES', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });

    const corrected = instances.filter((i) => i.status === 'CORRECTED').length;

    return (
        <div className="instances-page">
            {/* Breadcrumb */}
            <nav className="breadcrumb" aria-label="Navegación">
                <Link to="/professor/subjects" className="breadcrumb__item">{t('professor.subjects.title').split(' ').pop()}</Link>
                <span className="breadcrumb__sep" aria-hidden="true">›</span>
                {subject ? (
                    <Link
                        to={`/professor/subjects/${subjectCode}`}
                        state={{ subjectCode }}
                        className="breadcrumb__item"
                    >
                        {subject.name}
                    </Link>
                ) : (
                    <span className="breadcrumb__item">{subjectCode}</span>
                )}
                <span className="breadcrumb__sep" aria-hidden="true">›</span>
                <span className="breadcrumb__item breadcrumb__item--active">{exam.name}</span>
            </nav>

            {/* Exam header */}
            <div className="instances-page__hero">
                <div className="instances-page__hero-text">
                    <h1 className="instances-page__title">{exam.name}</h1>
                    <p className="instances-page__meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {dateStr} · {exam.time}
                    </p>
                </div>
                <div className="subject-page__stats">
                    <div className="stat-card">
                        <span className="stat-card__value">{instances.length}</span>
                        <span className="stat-card__label">{t('professor.instances.title')}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-card__value">{corrected}</span>
                        <span className="stat-card__label">{t('professor.instances.corrected')}</span>
                    </div>
                </div>
            </div>

            {/* Instances table */}
            {instances.length === 0 ? (
                <div className="empty-state">
                    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
                        <circle cx="32" cy="32" r="30" fill="#f0f4ff" />
                        <circle cx="32" cy="24" r="8" fill="white" stroke="#a0b4d8" strokeWidth="2" />
                        <path d="M16 48c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#a0b4d8" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </svg>
                    <p>{t('professor.instances.empty')}</p>
                </div>
            ) : (
                <div className="instances-table-wrapper">
                    <table className="instances-table">
                        <thead>
                            <tr>
                                <th className="th-avatar" />
                                <th>{t('professor.instances.student')}</th>
                                <th>{t('professor.instances.status')}</th>
                                <th>{t('professor.instances.grade')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {instances.map((inst) => (
                                <InstanceRow key={inst.id} instance={inst} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
