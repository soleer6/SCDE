import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../layouts/AppLayout';

// Lazy-load all pages — Vite generates separate chunks per page.
// ProfessorCorrectionPage and StudentResultPage pull in react-pdf/pdf.js
// (~2 MB), so lazy-loading avoids penalising the initial bundle.
const LoginPage               = lazy(() => import('../pages/LoginPage'));
const ProfessorDashboardPage  = lazy(() => import('../pages/ProfessorDashboardPage'));
const ProfessorSubjectsPage   = lazy(() => import('../pages/ProfessorSubjectsPage'));
const ProfessorExamsPage      = lazy(() => import('../pages/ProfessorExamsPage'));
const ProfessorInstancesPage  = lazy(() => import('../pages/ProfessorInstancesPage'));
const ProfessorCorrectionPage = lazy(() => import('../pages/ProfessorCorrectionPage'));
const StudentSubjectsPage     = lazy(() => import('../pages/StudentSubjectsPage'));
const StudentExamsPage        = lazy(() => import('../pages/StudentExamsPage'));
const StudentResultPage       = lazy(() => import('../pages/StudentResultPage'));

function PageLoader() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: '200px',
            color: '#718096',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.9rem',
        }}>
            Cargando…
        </div>
    );
}

export default function AppRouter() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* Public */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected – PROFESSOR */}
                <Route element={<ProtectedRoute allowedRole="PROFESSOR" />}>
                    <Route element={<AppLayout />}>
                        <Route path="/professor" element={<ProfessorDashboardPage />} />
                        <Route path="/professor/subjects" element={<ProfessorSubjectsPage />} />
                        <Route path="/professor/subjects/:code" element={<ProfessorExamsPage />} />
                        <Route path="/professor/exams/:examId" element={<ProfessorInstancesPage />} />
                        <Route path="/professor/correction/:instanceId" element={<ProfessorCorrectionPage />} />
                    </Route>
                </Route>

                {/* Protected – STUDENT */}
                <Route element={<ProtectedRoute allowedRole="STUDENT" />}>
                    <Route element={<AppLayout />}>
                        <Route path="/student/subjects" element={<StudentSubjectsPage />} />
                        <Route path="/student/subjects/:subjectId" element={<StudentExamsPage />} />
                        <Route path="/student/result/:examId" element={<StudentResultPage />} />
                    </Route>
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Suspense>
    );
}
