"""Create one new synthetic superadmin for H17; never elevate an existing user.

Credentials remain in the private /runtime mount; no password is printed.
"""
import json
import secrets
from pathlib import Path
from uuid import uuid4

from django.contrib.auth import get_user_model
from apps.organizations.models.organization import Organization

path = Path('/runtime/fixtures-b-h17.local.json')
if path.exists():
    data = json.loads(path.read_text())
    user = get_user_model().objects.get(email=data['superadmin'])
    assert user.is_superadmin and user.is_active
    print('Existing synthetic H17 superadmin preserved.')
else:
    base = json.loads(Path('/runtime/fixtures-b.local.json').read_text())
    org = Organization.objects.get(pk=base['organizationId'])
    suffix = uuid4().hex[:12]
    password = secrets.token_urlsafe(24)
    email = f'h17-platform-{suffix}@scde.local'
    get_user_model().objects.create_superuser(email=email, password=password,
        organization=org, first_name='H17', last_name='Synthetic')
    path.write_text(json.dumps({'superadmin': email, 'password': password, 'organizationId': str(org.pk)}))
    path.chmod(0o600)
    print('New synthetic H17 superadmin created. Credentials stored only in runtime.')
