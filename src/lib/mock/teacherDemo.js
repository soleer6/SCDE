// Explicit opt-in scenario (?resetMock=teacher): Irene Martín's Parcial 2 de Cálculo I goes back to
// "pending grading" with no scores, comments, audio or annotations, and Javier Ruiz is assigned the
// problems he corrects (2 and 3). Everything else (other students, roles, permissions) is untouched.
export const TEACHER_DEMO_INSTANCE = 'i-e-mat-p2-3';

export function prepareTeacherDemo(data) {
  const inst = data.instances.find((i) => i.id === TEACHER_DEMO_INSTANCE);
  if (!inst) return data;
  inst.status = 'PENDING_GRADING';
  inst.total_score = null;
  inst.has_issues = false;
  inst.issue_types = [];
  data.grades = data.grades.filter((g) => g.instance_id !== inst.id);
  data.annotations = (data.annotations ?? []).filter((a) => a.instance_id !== inst.id);
  const problems = data.problems.filter((p) => p.exam_model_id === inst.model_id).sort((a, b) => a.order - b.order);
  const assigned = problems.slice(1).map((p) => p.id);
  const rule = data.assignment_rules.find((r) => r.id === 'ar-mat-p2');
  if (!rule) {
    data.assignment_rules.push({ id: 'ar-mat-p2', exam_id: inst.exam_id, groups: [], models_filter: [], problems: assigned, correctors: ['u-javier'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  } else if (!rule.correctors.includes('u-javier')) {
    rule.correctors.push('u-javier');
  }
  // The browser also caches the last scores it saved per instance; drop that so the reset is visible.
  try {
    localStorage.removeItem(`scde.grades.${inst.id}`);
  } catch {
    /* storage unavailable */
  }
  return data;
}
