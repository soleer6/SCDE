import json, secrets
from pathlib import Path
from decimal import Decimal
from django.db import transaction
from apps.core.management.commands.seed_load_test_data import Command
from apps.exams.models.exams import Problem, RubricCriterion
path = Path('/runtime/fixtures-claude-negative.local.json')
if path.exists():
    print('Fixture propia existente; se conserva')
else:
    password = secrets.token_urlsafe(24)
    with transaction.atomic():
        w = Command()._provision(1, 1, password)
        problem = Problem.objects.create(exam_model=w['model'], name='Penalizaci?n', max_score=Decimal('10.00'), order=2)
        RubricCriterion.objects.create(problem=w['problem'], description='Penalizaci?n por error', score=Decimal('-2.00'), order=1)
        student, inst = w['students'][0]
        inst.status = 'PENDING_GRADING'
        inst.save(update_fields=['status'])
    fixture = dict(purpose='H02 notas negativas: organizaci?n sint?tica nueva del carril frontend', organizationId=str(w['org'].pk), examId=str(w['exam'].pk), instanceId=str(inst.pk), problemId=str(problem.pk), rubricProblemId=str(w['problem'].pk), manager=w['manager'].email, teacher=w['graders'][0].email, password=password)
    path.write_text(json.dumps(fixture, indent=2))
    path.chmod(0o600)
    print('Fixture sint?tica propia creada sin modificar datos existentes')
