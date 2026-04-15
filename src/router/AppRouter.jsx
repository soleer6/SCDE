import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../layouts/AppLayout';
import LoginPage from '../pages/LoginPage';
import ProfessorSubjectsPage from '../pages/ProfessorSubjectsPage';
import ProfessorExamsPage from '../pages/ProfessorExamsPage';
import ProfessorInstancesPage from '../pages/ProfessorInstancesPage';
import StudentSubjectsPage from '../pages/StudentSubjectsPage';
import ProfessorCorrectionPage from '../pages/ProfessorCorrectionPage';

export default function AppRouter() {
    return (
        <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected – PROFESSOR */}
            <Route element={<ProtectedRoute allowedRole="PROFESSOR" />}>
                <Route element={<AppLayout />}>
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
                </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
