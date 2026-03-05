import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const color = getColor(index);

    return (
        <div className="subject-card" style={{ '--card-bg': color.bg, '--card-accent': color.accent }}>
            <div className="subject-card__icon-wrap" style={{ background: color.accent }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
            </div>

            <div className="subject-card__body">
                <span className="subject-card__code" style={{ color: color.accent }}>{subject.code}</span>
                <h3 className="subject-card__name">{subject.name}</h3>
                <div className="subject-card__meta">
                    {subject.semester && (
                        <span className="subject-card__pill">
                            {t('common.semester')} {subject.semester}
                        </span>
                    )}
                    {subject.year && (
                        <span className="subject-card__pill">{subject.year}</span>
                    )}
                </div>
            </div>

            <button className="subject-card__action" style={{ background: color.accent }}>
                {t('common.viewExams')}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
}

export default function StudentSubjectsPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const subjects = user?.subjects || [];

    return (
        <div className="subject-page">
            <div className="subject-page__hero">
                <div className="subject-page__hero-text">
                    <p className="subject-page__greeting">{t('common.greeting')}, {user?.firstName} 👋</p>
                    <h1 className="subject-page__title">{t('student.subjects.title')}</h1>
                    <p className="subject-page__subtitle">
                        {t('student.subjects.subtitle')}
                    </p>
                </div>
                <div className="subject-page__stats">
                    <div className="stat-card">
                        <span className="stat-card__value">{subjects.length}</span>
                        <span className="stat-card__label">{t('student.subjects.title').split(' ').pop()}</span>
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
                    <p>{t('student.subjects.empty')}</p>
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
