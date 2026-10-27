"""Create new synthetic H01 tenants. No shared fixtures, deletions or restarts."""
import json
import django
django.setup()
from django.utils import timezone
from apps.subjects.tests.test_permissions import _setup_org_with_course, _create_user
from apps.subjects.models.subjects import Subject, SubjectMembership
from apps.organizations.models.organization_config import OrganizationConfig
from apps.exams.models.exams import Exam, ExamModel, Problem

org, manager, course = _setup_org_with_course()
teacher = _create_user(org)
coordinator = _create_user(org)
foreign_org, foreign, _ = _setup_org_with_course()
config, _ = OrganizationConfig.objects.get_or_create(organization=org)
config.role_permission_defaults = {}
config.save()
subject = Subject.objects.create(organization=org, course=course, coordinator=coordinator, name='Permisos efectivos H01', code='H01')
membership = SubjectMembership.objects.create(organization=org, subject=subject, user=teacher, role='TEACHER')
coord_membership = SubjectMembership.objects.create(organization=org, subject=subject, user=coordinator, role='COORDINATOR')
exam = Exam.objects.create(organization=org, subject=subject, name='Examen H01', date=timezone.now())
model = ExamModel.objects.create(exam=exam, label='A')
Problem.objects.create(exam_model=model, name='Problema H01', max_score=10, order=1)
print(json.dumps(dict(organizationId=str(org.pk), courseId=str(course.pk), subjectId=str(subject.pk),
    membershipId=str(membership.pk), coordinatorMembershipId=str(coord_membership.pk), examId=str(exam.pk),
    teacher=teacher.email, coordinator=coordinator.email, password='Pass123!', manager=manager.email,
    managerPassword='MgrPass123!', foreign=foreign.email, foreignPassword='MgrPass123!')))
