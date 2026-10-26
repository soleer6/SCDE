import json, secrets
from decimal import Decimal
from pathlib import Path
from django.db import transaction
from apps.core.management.commands.seed_load_test_data import Command
from apps.exams.models.exams import Problem
from apps.organizations.models.organization_config import OrganizationConfig
path = Path('/runtime/fixtures-claude-h04.local.json')
if path.exists():
    raise SystemExit('exists')
password = secrets.token_urlsafe(24)
with transaction.atomic():
    w = Command()._provision(2, 1, password)
    OrganizationConfig.objects.get_or_create(organization=w['org'])
    p2 = Problem.objects.create(name='P2 ajeno', max_score=Decimal('5.00'), exam_model=w['model'], order=2)
    (s0, i0), _ = w['students']
    i0.status = 'PENDING_GRADING'; i0.save(update_fields=['status'])
fx = dict(purpose='H04 corrector de un problema', examId=str(w['exam'].pk), instanceId=str(i0.pk), ownProblem=str(w['problem'].pk), otherProblem=str(p2.pk), teacher=w['graders'][0].email, password=password)
path.write_text(json.dumps(fx, indent=2)); path.chmod(0o600)
print('created')
