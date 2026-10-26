import json, secrets
from pathlib import Path
from django.db import transaction
from apps.core.management.commands.seed_load_test_data import Command
from apps.organizations.models.organization_config import OrganizationConfig
path = Path('/runtime/fixtures-claude-h15.local.json')
if path.exists():
    raise SystemExit('exists')
password = secrets.token_urlsafe(24)
with transaction.atomic():
    w = Command()._provision(2, 1, password)
    OrganizationConfig.objects.get_or_create(organization=w['org'])
    (s0, i0), (s1, i1) = w['students']
    for inst in (i0, i1):
        inst.status = 'GRADED'
        inst.save(update_fields=['status'])
    i0.has_issues = True
    i0.save(update_fields=['has_issues'])
fx = dict(purpose='H15 publicacion parcial', examId=str(w['exam'].pk), blockedInstanceId=str(i0.pk), okInstanceId=str(i1.pk), manager=w['manager'].email, blocked=s0.email, ok=s1.email, password=password)
path.write_text(json.dumps(fx, indent=2)); path.chmod(0o600)
print('created')
