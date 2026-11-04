"""Small, isolated fixture on the real backend; never flushes existing data."""
import io
import json
import secrets
from pathlib import Path

from django.conf import settings
from django.db import transaction
from reportlab.pdfgen.canvas import Canvas

from apps.core.management.commands.seed_load_test_data import Command
from apps.exams.services.storage import _get_s3_client, upload_to_minio
from apps.organizations.models.organization import Organization
from apps.organizations.models.organization_config import OrganizationConfig

fixture_path = Path('/runtime/fixtures.local.json')
if fixture_path.exists():
    existing = json.loads(fixture_path.read_text())
    if not Organization.objects.filter(pk=existing['organizationId']).exists():
        raise RuntimeError('Fixture exists but its organization is missing; no data was overwritten.')
    print('Existing integration fixture preserved.')
else:
    s3 = _get_s3_client()
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    if bucket not in [item['Name'] for item in s3.list_buckets()['Buckets']]:
        s3.create_bucket(Bucket=bucket)
    password = secrets.token_urlsafe(24)
    with transaction.atomic():
        world = Command()._provision(2, 1, password)
        config, _ = OrganizationConfig.objects.get_or_create(organization=world['org'])
        config.default_ocr_engine = 'tesseract'
        config.save()
        # The upstream load-test seed stores an invalid minimal PDF. Use a real
        # three-page blank document so upload/download/viewer tests are meaningful.
        stream = io.BytesIO()
        canvas = Canvas(stream)
        for n in range(1, 4):
            canvas.drawString(60, 790, f'SCDE integration - page {n}')
            canvas.showPage()
        canvas.save()
        data = stream.getvalue()
        upload_to_minio(key=world['model'].blank_pdf_ref, data=data)
        world['model'].blank_pdf_size = len(data)
        world['model'].save()
        pending = world['students'][0][1]
        pending.status = 'PENDING_GRADING'
        pending.total_score = None
        pending.save()
    fixture = {
        'organizationId': str(world['org'].pk),
        'examId': str(world['exam'].pk),
        'modelId': str(world['model'].pk),
        'problemId': str(world['problem'].pk),
        'instanceId': str(pending.pk),
        'publishedInstanceId': str(world['students'][1][1].pk),
        'password': password,
        'manager': world['manager'].email,
        'teacher': world['graders'][0].email,
        'student': world['students'][0][0].email,
        'publishedStudent': world['students'][1][0].email,
    }
    fixture_path.write_text(json.dumps(fixture, indent=2))
    fixture_path.chmod(0o600)
    print('Isolated integration fixture created (2 students, 1 teacher, 1 manager).')
