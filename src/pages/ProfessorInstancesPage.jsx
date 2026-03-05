import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getExamById, getInstancesByExam, getStatusMeta } from '../api/mockData';
import './ProfesorInstanciasPage.css';

function StatusBadge({ estado }) {
    const meta = getStatusMeta(estado);
    return (
        <span className="status-badge" style={{ color: meta.color, background: meta.bg }}>
            {meta.label}
        </span>
    );
}

function GradeChip({ calificacion }) {
    if (calificacion === null || calificacion === undefined) {
        return <span className="grade-chip grade-chip--empty">—</span>;
    }
    const cls = calificacion >= 5 ? 'grade-chip--pass' : 'grade-chip--fail';
    return <span className={`grade-chip ${cls}`}>{calificacion.toFixed(1)}</span>;
}

function InstanceRow({ instance }) {
    const handleClick = () => {
        console.log('[SCDE] Navegando a instancia:', instance);
        // TODO: navigate to /profesor/instancias/:id when that view is ready
    };

    return (
        <tr
            className="instance-row"
            onClick={handleClick}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleClick()}
            role="button"
            aria-label={`Ver instancia de ${instance.nombre} ${instance.apellidos}`}
        >
            <td className="instance-cell instance-cell--avatar">
                <div className="instance-avatar">
                    {instance.nombre[0]}{instance.apellidos[0]}
                </div>
            </td>
            <td className="instance-cell instance-cell--name">
                <span className="instance-name">{instance.nombre} {instance.apellidos}</span>
                <span className="instance-nia">NIA: {instance.nia}</span>
            </td>
            <td className="instance-cell instance-cell--status">
                <StatusBadge estado={instance.estado} />
            </td>
            <td className="instance-cell instance-cell--grade">
                <GradeChip calificacion={instance.calificacion} />
            </td>
            <td className="instance-cell instance-cell--action">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </td>
        </tr>
    );
}

export default function ProfesorInstanciasPage() {
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
                <button className="btn-back" onClick={() => navigate('/profesor/asignaturas')}>
                    ← Volver a mis asignaturas
                </button>
            </div>
        );
    }

    const dateStr = new Date(exam.fecha + 'T' + exam.hora).toLocaleDateString('es-ES', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });

    const corrected = instances.filter((i) => i.estado === 'CORRECTED').length;

    return (
        <div className="instances-page">
            {/* Breadcrumb */}
            <nav className="breadcrumb" aria-label="Navegación">
                <Link to="/profesor/asignaturas" className="breadcrumb__item">Asignaturas</Link>
                <span className="breadcrumb__sep" aria-hidden="true">›</span>
                {subject ? (
                    <Link
                        to={`/profesor/asignaturas/${subjectCode}`}
                        state={{ subjectCode }}
                        className="breadcrumb__item"
                    >
                        {subject.nombre}
                    </Link>
                ) : (
                    <span className="breadcrumb__item">{subjectCode}</span>
                )}
                <span className="breadcrumb__sep" aria-hidden="true">›</span>
                <span className="breadcrumb__item breadcrumb__item--active">{exam.nombre}</span>
            </nav>

            {/* Exam header */}
            <div className="instances-page__hero">
                <div className="instances-page__hero-text">
                    <h1 className="instances-page__title">{exam.nombre}</h1>
                    <p className="instances-page__meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {dateStr} · {exam.hora}
                    </p>
                </div>
                <div className="subject-page__stats">
                    <div className="stat-card">
                        <span className="stat-card__value">{instances.length}</span>
                        <span className="stat-card__label">Instancias</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-card__value">{corrected}</span>
                        <span className="stat-card__label">Corregidas</span>
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
                    <p>No hay instancias para este examen.</p>
                </div>
            ) : (
                <div className="instances-table-wrapper">
                    <table className="instances-table">
                        <thead>
                            <tr>
                                <th className="th-avatar" />
                                <th>Alumno</th>
                                <th>Estado</th>
                                <th>Calificación</th>
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
