/* Domain constants/helpers shared by the core-flow features. */

export const LIFECYCLE = ['ASSEMBLING', 'RECEIVED', 'QUEUED', 'PENDING_GRADING', 'GRADED', 'PUBLISHED', 'IN_REVIEW', 'FINALIZED'];

/** Pass mark on a 0-10 scale (Spanish university convention). Not provided by the backend. */
export const PASS_MARK = 5;

export const GRADED_STATES = ['GRADED', 'PUBLISHED', 'IN_REVIEW', 'PENDING_REVIEW', 'FINALIZED', 'ARCHIVED'];

/** Display name from an institutional email (instances only expose student_email). */
export const studentName = (email) => {
  if (!email) return '—';
  return email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');
};
