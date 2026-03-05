import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SubjectPage.css';

const SUBJECT_COLORS = [
    { bg: '#e8f0fe', accent: '#2d6be4', icon: '#1a56db' },
    { bg: '#fce8ff', accent: '#9333ea', icon: '#7c3aed' },
    { bg: '#e8fef0', accent: '#16a34a', icon: '#15803d' },
    { bg: '#fff4e8', accent: '#ea8c00', icon: '#d97706' },
    { bg: '#e8f8fe', accent: '#0891b2', icon: '#0e7490' },
    { bg: '#fee8f0', accent: '#e4356a', icon: '#db2777' },
];

function getColor(index) {
    return SUBJECT_COLORS[index % SUBJECT_COLORS.length];
}

function SubjectCard({ subject, index }) {
    const color = getColor(index);

    return (
        <Link
            to={`/profesor/asignaturas/${subject.code}`}
            className="subject-card subject-card--link"
            style={{ '--card-bg': color.bg, '--card-accent': color.accent }}
            aria-label={`Ver exámenes de ${subject.nombre}`}
        >
            <div className="subject-card__icon-wrap" style={{ background: color.accent }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    <line x1="9" y1="9" x2="15" y2="9" />
                    <line x1="9" y1="13" x2="13" y2="13" />
                </svg>
            </div>

            <div className="subject-card__body">
                <span className="subject-card__code" style={{ color: color.accent }}>{subject.code}</span>
                <h3 className="subject-card__name">{subject.nombre}</h3>
                <div className="subject-card__meta">
                    {subject.cuatrimestre && (
                        <span className="subject-card__pill">Cuatrimestre {subject.cuatrimestre}</span>
                    )}
                    {subject.año && (
                        <span className="subject-card__pill">{subject.año}</span>
                    )}
                </div>
            </div>

            <div className="subject-card__action" style={{ background: color.accent }}>
                Ver asignatura
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
            </div>
        </Link>
    );
}

export default function ProfesorAsignaturasPage() {
    const { user } = useAuth();
    const subjects = user?.subjects || [];

    return (
        <div className="subject-page">
            <div className="subject-page__hero">
                <div className="subject-page__hero-text">
                    <p className="subject-page__greeting">Bienvenido/a, {user?.nombre} 👋</p>
                    <h1 className="subject-page__title">Mis Asignaturas</h1>
                    <p className="subject-page__subtitle">
                        Gestiona las correcciones de exámenes de tus asignaturas asignadas.
                    </p>
                </div>
                <div className="subject-page__stats">
                    <div className="stat-card">
                        <span className="stat-card__value">{subjects.length}</span>
                        <span className="stat-card__label">Asignaturas</span>
                    </div>
                </div>
            </div>

            {subjects.length === 0 ? (
                <div className="empty-state">
                    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
                        <circle cx="32" cy="32" r="30" fill="#f0f4ff" />
                        <path d="M20 44V20h24v24H20z" stroke="#a0b4d8" strokeWidth="2" strokeLinejoin="round" fill="white" />
                        <line x1="25" y1="28" x2="39" y2="28" stroke="#a0b4d8" strokeWidth="2" strokeLinecap="round" />
                        <line x1="25" y1="33" x2="35" y2="33" stroke="#a0b4d8" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <p>No tienes asignaturas asignadas actualmente.</p>
                </div>
            ) : (
                <div className="subjects-grid">
                    {subjects.map((subject, i) => (
                        <SubjectCard key={subject.code} subject={subject} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
}
