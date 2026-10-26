"""Add an isolated notification batch to the existing synthetic b tenant.

Run via docker exec -i ... python manage.py shell; no mail, deletion or restart.
"""
import json
from pathlib import Path
from uuid import uuid4

from django.contrib.auth import get_user_model
from apps.notifications.models.notifications import Notification

fixture = json.loads(Path('/runtime/fixtures-b.local.json').read_text())
users = {role: get_user_model().objects.get(email=fixture[role]) for role in ('student', 'teacher')}
assert all(str(u.organization_id) == fixture['organizationId'] for u in users.values())
batch = uuid4().hex[:10]
for i in range(31):
    Notification.objects.create(user=users['student'], notification_type='GENERAL',
        title=f'H19 {batch} general {i:02}', message='Synthetic pagination acceptance.',
        metadata={'source': 'b-h19', 'batch': batch})
for role, kind, status in [('student', 'REVIEW_OPENED', 'UNREAD'),
                           ('student', 'GENERAL', 'ARCHIVED'), ('teacher', 'GENERAL', 'UNREAD')]:
    Notification.objects.create(user=users[role], notification_type=kind, status=status,
        title=f'H19 {batch} {role} {status}', message='Synthetic isolation acceptance.',
        metadata={'source': 'b-h19', 'batch': batch})
print(f'H19 batch {batch}: 34 synthetic notifications created, no email sent.')
