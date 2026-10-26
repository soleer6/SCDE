"""Synthetic fixture with a CLOSED review window (Claude lane, 23/10/2026).

New isolated organization; never touches or deletes existing data.
  PHASE=create  provision 2 students + 1 grader + manager, window OPEN
                (s0 then sends a review request over HTTP, from the host)
  PHASE=close   close_review() on this exam only, like Celery Beat at end_date
Run: docker exec -e PHASE=... scde-integration-api-1 python manage.py shell -c "exec(open('/runtime/bootstrap_closed_review.py').read())"
"""
import io
import json
import os
import secrets
from pathlib import Path

from django.db import transaction
from django.utils import timezone
from reportlab.pdfgen.canvas import Canvas

from apps.core.management.commands.seed_load_test_data import Command
from apps.exams.services.storage import upload_to_minio
from apps.organizations.models.organization import Organization
from apps.organizations.models.organization_config import OrganizationConfig
from apps.reviews.models.reviews import ExamReview, ReviewStatus
from apps.reviews.services.reviews import close_review
from apps.instances.models.instances import ExamInstance

path = Path('/runtime/fixtures-claude-h05.local.json')
phase = os.environ.get('PHASE')

if phase == 'create':
    if path.exists():
        raise SystemExit('Closed-review fixture already exists; nothing created.')
    password = secrets.token_urlsafe(24)
    with transaction.atomic():
        world = Command()._provision(2, 1, password)
        config, _ = OrganizationConfig.objects.get_or_create(organization=world['org'])
        config.default_ocr_engine = 'tesseract'
        config.save()
        stream = io.BytesIO()
        canvas = Canvas(stream)
        for n in range(1, 4):
            canvas.drawString(60, 790, f'SCDE closed review - page {n}')
            canvas.showPage()
        canvas.save()
        data = stream.getvalue()
        upload_to_minio(key=world['model'].blank_pdf_ref, data=data)
        world['model'].blank_pdf_size = len(data)
        world['model'].save()
    (s0, i0), (s1, i1) = world['students']
    fixture = {
        'purpose': 'H05 student PDF download (Claude, 26/10/2026)',
        'organizationId': str(world['org'].pk),
        'examId': str(world['exam'].pk),
        'modelId': str(world['model'].pk),
        'problemId': str(world['problem'].pk),
        'requesterInstanceId': str(i0.pk),
        'silentInstanceId': str(i1.pk),
        'password': password,
        'manager': world['manager'].email,
        'teacher': world['graders'][0].email,
        'requester': s0.email,
        'silent': s1.email,
        'reviewStatus': 'OPEN',
    }
    path.write_text(json.dumps(fixture, indent=2))
    path.chmod(0o600)
    print('created', fixture['organizationId'])
elif phase == 'close':
    fixture = json.loads(path.read_text())
    if fixture['reviewStatus'] != 'OPEN':
        raise SystemExit(f"Already {fixture['reviewStatus']}; nothing changed.")
    review = ExamReview.objects.get(exam_id=fixture['examId'], exam__organization_id=fixture['organizationId'], status=ReviewStatus.OPEN)
    review.end_date = timezone.now()
    review.save(update_fields=['end_date', 'updated_at'])
    result = close_review(review)
    review.refresh_from_db()
    fixture['reviewStatus'] = review.status
    fixture['instanceStatus'] = {
        k: ExamInstance.objects.get(pk=fixture[k]).status for k in ('requesterInstanceId', 'silentInstanceId')
    }
    path.write_text(json.dumps(fixture, indent=2))
    print('closed', result, fixture['instanceStatus'])
else:
    raise SystemExit('PHASE must be create or close')
