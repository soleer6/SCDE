"""New archived hierarchy in the synthetic b tenant; no course transition.

Never changes the active course, existing instances/users or retention settings.
"""
import json
from pathlib import Path
from uuid import uuid4
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import transaction
from apps.organizations.models.organization import Organization
from apps.courses.models.courses import AcademicCourse
from apps.subjects.models.subjects import Subject
from apps.exams.models.exams import Exam, ExamModel
from apps.instances.models.instances import ExamInstance

path = Path('/runtime/fixtures-b-h18.local.json')
base = json.loads(Path('/runtime/fixtures-b.local.json').read_text())
org = Organization.objects.get(pk=base['organizationId'])
active_ids = list(AcademicCourse.objects.filter(organization=org, is_active=True).values_list('pk', flat=True))
if path.exists():
    saved = json.loads(path.read_text())
    assert AcademicCourse.objects.get(pk=saved['courseId']).is_active is False
    if 'alternateModelId' not in saved:
        alternate = ExamModel.objects.create(exam_id=saved['examId'], label='Z2')
        saved['alternateModelId'] = str(alternate.pk)
        path.write_text(json.dumps(saved))
    print('Existing synthetic H18 archive preserved.')
else:
    manager = get_user_model().objects.get(email=base['manager'])
    student = get_user_model().objects.get(email=base['student'])
    suffix = uuid4().hex[:8]
    with transaction.atomic():
        course = AcademicCourse.objects.create(organization=org, label=f'Archivo H18 {suffix}', is_active=False)
        subject = Subject.objects.create(organization=org, course=course, coordinator=manager,
            name='Asignatura histórica H18', code=f'H18-{suffix}', semester='Anual')
        exam = Exam.objects.create(organization=org, subject=subject, name='Examen histórico H18')
        model = ExamModel.objects.create(exam=exam, label='Z')
        alternate = ExamModel.objects.create(exam=exam, label='Z2')
        for i in range(27):
            # Unidentified historical records avoid creating dozens of accounts.
            ExamInstance.objects.create(organization=org, exam=exam, model=model, status='ARCHIVED',
                total_score=Decimal('4.00'), expected_pages=1, has_issues=False)
        instance = ExamInstance.objects.create(organization=org, exam=exam, model=model, student=student,
            status='ARCHIVED', total_score=Decimal('0.00'), expected_pages=1, has_issues=True,
            issue_types=['MISSING_PAGE'])
    path.write_text(json.dumps({ 'courseId': str(course.pk), 'courseLabel': course.label,
        'subjectId': str(subject.pk), 'examId': str(exam.pk), 'modelId': str(model.pk),
        'instanceId': str(instance.pk), 'alternateModelId': str(alternate.pk), 'organizationId': str(org.pk) }))
    path.chmod(0o600)
    print('New H18 archive created: one inactive course, subject, exam, model and 28 instances; no transition.')
assert list(AcademicCourse.objects.filter(organization=org, is_active=True).values_list('pk', flat=True)) == active_ids
print('Active course unchanged; existing accounts/instances preserved.')
