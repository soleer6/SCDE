"""Create new unread notifications only for the isolated Codex fixture; no mail."""
import json
from pathlib import Path

from django.contrib.auth import get_user_model

from apps.notifications.models.notifications import Notification

fixture = json.loads(Path('/runtime/fixtures-codex.local.json').read_text())
users = [get_user_model().objects.get(email=fixture[role]) for role in ('teacher', 'student')]
assert all(str(user.organization_id) == fixture['organizationId'] for user in users)
for user in users:
    Notification.objects.create(
        user=user,
        notification_type='GENERAL',
        title='Validación P1 de notificaciones',
        message='Aviso sintético para comprobar lectura persistida y aislamiento.',
        metadata={'source': 'codex-p1-frontend'},
    )
print('Created 2 synthetic unread notifications in the Codex organization; no email sent.')
