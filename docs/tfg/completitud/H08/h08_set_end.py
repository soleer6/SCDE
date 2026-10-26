import json, os
from datetime import timedelta
from pathlib import Path
from django.utils import timezone
from apps.reviews.models.reviews import ExamReview, ReviewStatus
from apps.reviews.services.reviews import close_review
fx = json.loads(Path('/runtime/fixtures-claude-h05.local.json').read_text())
r = ExamReview.objects.get(exam_id=fx['examId'], exam__organization_id=fx['organizationId'])
if os.environ.get('PHASE') == 'close':
    r.end_date = timezone.now(); r.save(update_fields=['end_date', 'updated_at'])
    print(close_review(r)); r.refresh_from_db(); print(r.status)
else:
    r.status = ReviewStatus.OPEN
    r.end_date = timezone.now() + timedelta(seconds=int(os.environ.get('SECS', '10')))
    r.save(update_fields=['status', 'end_date', 'updated_at']); print('end in', os.environ.get('SECS'), 's', r.status)
