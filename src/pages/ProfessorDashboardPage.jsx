import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getMySubjects } from '../services/subjectService.js';
import { getExamsBySubject } from '../services/examService.js';
import { getInstancesByExam } from '../services/instanceService.js';
import { getStoredCorrection } from '../api/mockData';
import './SubjectPage.css';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

const SUBJECT_COLORS = [
    { bg: '#e8f0fe', accent: '#2d6be4' },
    { bg: '#fce8ff', accent: '#9333ea' },
    { bg: '#e8fef0', accent: '#16a34a' },
    { bg: '#fff4e8', accent: '#ea8c00' },
    { bg: '#e8f8fe', accent: '#0891b2' },
    { bg: '#fee8f0', accent: '#e4356a' },
];

function StatCard({ value, label, color }) {
    return (
        <div className="stat-card" style={color ? { borderTop: `3px solid ${color}` } : {}}>
            <span className="stat-card__value" style={color ? { color } : {}}>{value}</span>
            <span className="stat-card__label">{label}</span>
        </div>
    );
}

function SubjectQuickLink({ subject, instances, index }) {
    const { t } = useTranslation();
    const color = SUBJECT_COLORS[index % SUBJECT_COLORS.length];
    const pending = instances.filter((i) => i.status === 'PENDING').length;

    return (
        <Link
            to={`/professor/subjects/${subject.code}`}
            state={{ subjectId: subject.id, subjectName: subject.name, subjectSemester: subject.semester }}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                background: color.bg,
                textDecoration: 'none',
                border: `1px solid ${color.accent}22`,
                transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
            }}
        >
            <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: color.accent, letterSpacing: '0.04em' }}>
                    {subject.code}
                </span>
                <p style={{ margin: '2px 0 0', fontSize: '0.92rem', fontWeight: 600, color: '#1a202c' }}>
                    {subject.name}
                </p>
                {pending > 0 && (
                    <span style={{
                        display: 'inline-block', marginTop: '4px',
                        fontSize: '0.72rem', fontWeight: 500,
                        color: '#d97706', background: '#fef3c7',
                        borderRadius: '4px', padding: '1px 6px',
                    }}>
                        {pending} {t('professor.dashboard.pendingShort')}
                    </span>
                )}
            </div>
            <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke={color.accent} strokeWidth="2.5"
                aria-hidden="true"
            >
                <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
        </Link>
    );
}

export default function ProfessorDashboardPage() {
    const { t } = useTranslation();
    const { user } = useAuth();

    const [subjects, setSubjects] = useState([]);
    // { subjectId: { exams, instances } }
    const [subjectData, setSubjectData] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadDashboard() {
            try {
                const subs = USE_MOCK ? (user?.subjects || []) : await getMySubjects();
                setSubjects(subs);

                const entries = await Promise.all(
                    subs.map(async (s) => {
                        const subjectKey = s.id || s.code;
                        const exams = await getExamsBySubject(s.id || s.code).catch(() => []);
                        const allInstances = (await Promise.all(
                            exams.map((e) =>
                                getInstancesByExam(e.id).catch(() => []).then((insts) =>
                                    USE_MOCK
                                        ? insts.map((inst) => {
                                            const stored = getStoredCorrection(inst.id);
                                            return stored ? { ...inst, status: stored.status } : inst;
                                        })
                                        : insts
                                )
                            )
                        )).flat();
                        return [subjectKey, { exams, instances: allInstances }];
                    })
                );

                setSubjectData(Object.fromEntries(entries));
            } catch (err) {
                console.warn('Error cargando dashboard:', err);
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const allInstances = Object.values(subjectData).flatMap((d) => d.instances);
    const totalExams = Object.values(subjectData).reduce((acc, d) => acc + d.exams.length, 0);
    const pending = allInstances.filter((i) => i.status === 'PENDING').length;
    const corrected = allInstances.filter((i) => i.status === 'CORRECTED').length;

    if (loading) {
        return (
            <div className="subject-page">
                <p style={{ padding: '2rem', color: '#718096' }}>{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div className="subject-page">
            {/* Hero */}
            <div className="subject-page__hero">
                <div className="subject-page__hero-text">
                    <p className="subject-page__greeting">
                        {t('common.welcome')}, {user?.firstName} 👋
                    </p>
                    <h1 className="subject-page__title">
                        {t('professor.dashboard.title')}
                    </h1>
                    <p className="subject-page__subtitle">
                        {pending > 0
                            ? t('professor.dashboard.hasPending', { count: pending })
                            : t('professor.dashboard.allDone')}
                    </p>
                </div>
                <div className="subject-page__stats" style={{ flexWrap: 'wrap', gap: '12px' }}>
                    <StatCard value={subjects.length} label={t('professor.dashboard.stats.subjects')} />
                    <StatCard value={totalExams} label={t('professor.dashboard.stats.exams')} />
                    <StatCard
                        value={pending}
                        label={t('professor.dashboard.stats.pending')}
                        color={pending > 0 ? '#d97706' : undefined}
                    />
                    <StatCard
                        value={corrected}
                        label={t('professor.dashboard.stats.corrected')}
                        color={corrected > 0 ? '#16a34a' : undefined}
                    />
                </div>
            </div>

            {/* Quick access */}
            <section style={{ marginTop: '2rem' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '16px',
                }}>
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#2d3748' }}>
                        {t('professor.dashboard.quickAccess')}
                    </h2>
                    <Link
                        to="/professor/subjects"
                        style={{ fontSize: '0.82rem', color: '#2d6be4', textDecoration: 'none', fontWeight: 500 }}
                    >
                        {t('professor.dashboard.allSubjects')} →
                    </Link>
                </div>

                {subjects.length === 0 ? (
                    <div className="empty-state">
                        <p>{t('professor.subjects.empty')}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                        {subjects.map((subject, i) => {
                            const key = subject.id || subject.code;
                            const data = subjectData[key] || { instances: [] };
                            return (
                                <SubjectQuickLink
                                    key={subject.id || subject.code}
                                    subject={subject}
                                    instances={data.instances}
                                    index={i}
                                />
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Progress bar per subject */}
            <section style={{ marginTop: '2rem' }}>
                <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600, color: '#2d3748' }}>
                    {t('professor.dashboard.progress')}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {subjects.map((subject, i) => {
                        const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                        const key = subject.id || subject.code;
                        const instances = (subjectData[key] || {}).instances || [];
                        const correctedCount = instances.filter((inst) => inst.status === 'CORRECTED').length;
                        const total = instances.length;
                        const pct = total === 0 ? 0 : Math.round((correctedCount / total) * 100);

                        return (
                            <div key={subject.id || subject.code} style={{ background: 'white', borderRadius: '12px', padding: '14px 18px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#2d3748' }}>
                                        {subject.name}
                                    </span>
                                    <span style={{ fontSize: '0.82rem', color: '#718096' }}>
                                        {correctedCount}/{total}
                                    </span>
                                </div>
                                <div style={{ height: '6px', borderRadius: '3px', background: '#edf2f7', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${pct}%`,
                                        background: pct === 100 ? '#16a34a' : color.accent,
                                        borderRadius: '3px',
                                        transition: 'width 0.4s ease',
                                    }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
