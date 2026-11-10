// Explicit reset scenario for trying the student's complete result/review flow.
// Other students keep their grading tasks and grades unchanged.
export function prepareStudentDemo(data, now = Date.now()) {
  const student = data.users.find((u) => u.id === 'u-elena');
  if (!student) return data;
  for (const inst of data.instances.filter((i) => i.student_id === student.id)) {
    const exam = data.exams.find((e) => e.id === inst.exam_id);
    if (!exam) continue;
    Object.assign(exam.student_permissions, {
      can_view_pages: true, can_view_annotations: true, can_view_rubric: true,
      can_view_grade_breakdown: true, can_view_pages_after_review: true,
    });
    inst.status = 'IN_REVIEW';
    inst.has_issues = false;
    inst.issue_types = [];
    const problems = data.problems.filter((p) => p.exam_model_id === inst.model_id);
    for (const p of problems) {
      if (!data.grades.some((g) => g.instance_id === inst.id && g.problem_id === p.id)) {
        data.grades.push({ id: `gr-demo-${inst.id}-${p.id}`, instance_id: inst.id,
          problem_id: p.id, score: Math.round(p.max_score * 0.7 * 100) / 100,
          grader_id: 'u-maria', rubric_selections: [] });
      }
    }
    inst.total_score = data.grades.filter((g) => g.instance_id === inst.id).reduce((sum, g) => sum + Number(g.score), 0);
    let review = data.reviews.find((rv) => rv.exam_id === exam.id);
    if (!review) { review = { id: `rv-demo-${exam.id}`, exam_id: exam.id, created_at: new Date(now).toISOString() }; data.reviews.push(review); }
    Object.assign(review, { status: 'OPEN', start_date: new Date(now - 86400000).toISOString(), end_date: new Date(now + 14 * 86400000).toISOString() });
  }
  ensureDemoCorrectorRule(data, now);
  return data;
}

// Javier corrects Cálculo I · Parcial 1: as its assigned corrector he receives its review requests
// (get_pending_reviews_for_corrector), without extra subject permissions. Applied on every load so
// browsers holding data saved by an earlier version get it too, not only after ?resetMock=student.
export function ensureDemoCorrectorRule(data, now = Date.now()) {
  const p1 = (data.problems ?? []).filter((p) => p.exam_model_id === 'mdl-e-mat-p1').map((p) => p.id);
  if (p1.length && data.assignment_rules && !data.assignment_rules.some((r) => r.id === 'ar-demo-mat-p1')) {
    const at = new Date(now).toISOString();
    data.assignment_rules.push({ id: 'ar-demo-mat-p1', exam_id: 'e-mat-p1', groups: [], models_filter: [], problems: p1,
      correctors: ['u-javier'], created_at: at, updated_at: at });
  }
  return data;
}
