import json, secrets
from pathlib import Path
from django.db import transaction
from apps.core.management.commands.seed_load_test_data import Command
from apps.organizations.models.organization_config import OrganizationConfig
path = Path('/runtime/fixtures-claude-authors.local.json')
if path.exists():
    print('Fixture propia existente; conservada')
else:
    password = secrets.token_urlsafe(24)
    with transaction.atomic():
        w = Command()._provision(2, 2, password)
        OrganizationConfig.objects.get_or_create(organization=w['org'])
        student, inst = w['students'][0]
        inst.status = 'PENDING_REVIEW'
        inst.save(update_fields=['status'])
    fx = dict(purpose='H03 autores de anotaciones, organización sintética nueva', organizationId=str(w['org'].pk), examId=str(w['exam'].pk), instanceId=str(inst.pk), otherInstanceId=str(w['students'][1][1].pk), problemId=str(w['problem'].pk), teacher=w['graders'][0].email, otherTeacher=w['graders'][1].email, manager=w['manager'].email, student=student.email, otherStudent=w['students'][1][0].email, password=password)
    path.write_text(json.dumps(fx, indent=2))
    path.chmod(0o600)
    print('Creada organización sintética nueva para H03')
