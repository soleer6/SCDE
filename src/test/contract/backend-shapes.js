/* Response shapes the backend really sends but its OpenAPI does not declare
 * (gap-10 in docs/tfg/03-backend-gaps.md). Transcribed from the Django
 * serializers of anxoCRuam/SCDEE (branch backend); each one cites its source.
 *
 * The contract test accepts these as alternatives to the declared schema,
 * so the mock is still checked field by field against the real backend,
 * and fails when an alternative stops being needed (the gap was fixed).
 */
import spec from './openapi.json';

const ExamFull = spec.schemas.ExamFull;
const omit = (schema, keys) => ({
  ...schema,
  properties: Object.fromEntries(Object.entries(schema.properties).filter(([k]) => !keys.includes(k))),
  required: schema.required.filter((k) => !keys.includes(k)),
});

/* apps/exams/serializers/exams.py · ExamTeacherSerializer.get_models_problems:
 * problems is a ProblemResponseSerializer list, typed as dict[str, str]. */
const ModelProblems = {
  type: 'object',
  properties: {
    model_id: { type: 'string' },
    label: { type: 'string' },
    problems: { type: 'array', items: { $ref: '#/components/schemas/ProblemResponse' } },
  },
  required: ['model_id', 'label', 'problems'],
};

const ExamFullReal = { ...ExamFull, properties: { ...ExamFull.properties, models_problems: { type: 'array', items: ModelProblems } } };

/* apps/exams/views/exams.py · ExamListView/ExamDetailView/MyExamsView pick the
 * serializer by role: Full (can_create_exams), Teacher, Basic (students). */
const ExamVariants = [
  { name: 'ExamFull (models_problems typed)', schema: ExamFullReal },
  { name: 'ExamTeacherSerializer', schema: omit(ExamFullReal, ['student_permissions']) },
  { name: 'ExamBasicSerializer', schema: omit(ExamFullReal, ['student_permissions', 'models_problems', 'convocation']) },
];

/* apps/instances/serializers/instances.py · StudentInstanceSerializer; the
 * optional keys depend on the exam's student_permissions. */
const StudentInstance = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    exam_name: { type: 'string' },
    subject_name: { type: 'string' },
    status: { type: 'string' },
    total_score: { type: 'string', format: 'decimal', nullable: true },
    pages: { type: 'array', items: { $ref: '#/components/schemas/PageResponse' } },
    rubric: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          problem_name: { type: 'string' },
          max_score: { type: 'string' },
          criteria: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, score: { type: 'string' } }, required: ['description', 'score'] } },
        },
        required: ['problem_name', 'max_score', 'criteria'],
      },
    },
    grades: {
      type: 'array',
      items: { type: 'object', properties: { problem_name: { type: 'string' }, score: { type: 'string' }, rubric_selections: {} }, required: ['problem_name', 'score', 'rubric_selections'] },
    },
    can_download: { type: 'boolean' },
  },
  required: ['id', 'exam_name', 'subject_name', 'status', 'total_score', 'can_download'],
};

/* The mock deliberately adds problem_id to rubric[] and grades[] so a student
 * can request a review (docs/tfg/03-backend-gaps.md#gap-2, marked PROPOSAL in
 * exams/mockSerializers.js). Declared here so it is the only tolerated extra. */
const withProblemId = (items) => ({ ...items, properties: { problem_id: { type: 'string' }, ...items.properties } });
const StudentInstanceProposal = {
  ...StudentInstance,
  properties: {
    ...StudentInstance.properties,
    rubric: { type: 'array', items: withProblemId(StudentInstance.properties.rubric.items) },
    grades: { type: 'array', items: withProblemId(StudentInstance.properties.grades.items) },
  },
};
const StudentVariants = [
  { name: 'StudentInstanceSerializer', schema: StudentInstance },
  { name: 'StudentInstanceSerializer + problem_id (gap-2 proposal)', schema: StudentInstanceProposal },
];

const ExamList = { name: '[ExamFull | ExamTeacher | ExamBasic]', schema: { type: 'array', items: { oneOf: ExamVariants.map((v) => v.schema) } } };

/* Keyed by "METHOD template" (without /api/v1). */
export const BACKEND_SHAPES = {
  'GET /exams/{exam_pk}/': ExamVariants,
  'GET /subjects/{subject_pk}/exams/': [ExamList],
  'GET /my-exams/': [ExamList],
  // apps/instances/views/instances.py · InstanceListView: a student gets a bare list.
  'GET /exams/{exam_pk}/instances/': StudentVariants.map(({ name, schema }) => ({ name: `[${name}]`, schema: { type: 'array', items: schema } })),
  // apps/instances/views/instances.py · InstanceDetailView: the student branch.
  'GET /instances/{instance_pk}/': StudentVariants,
};

/* Same idea for the answers to mutations (src/test/contract/mutations.js). */
const nullable = (schema, keys) => ({
  ...schema,
  properties: { ...schema.properties, ...Object.fromEntries(keys.map((k) => [k, { ...schema.properties[k], nullable: true }])) },
});
const CourseNullableDates = [
  { name: 'Course (dates nullable)', schema: nullable(spec.schemas.Course, ['start_date', 'end_date']) },
];

export const MUTATION_SHAPES = {
  // apps/exams/models/exams.py · Exam.date is null=True; the serializer declares it non-nullable.
  'POST /subjects/{subject_pk}/exams/': [{ name: 'ExamFull (date nullable)', schema: nullable(ExamFullReal, ['date']) }],
  // apps/exams/views/exams.py · ZoneCreateView answers ZoneResponseSerializer(zones, many=True).
  'POST /page-profiles/{profile_pk}/zones/': [
    { name: '[ZoneResponse]', schema: { type: 'array', items: { $ref: '#/components/schemas/ZoneResponse' } } },
  ],
  // apps/courses/models/courses.py · start_date/end_date are null=True (CreateCourseSerializer defaults them to None).
  'POST /courses/': CourseNullableDates,
  'PATCH /courses/{id}/': CourseNullableDates,
};
