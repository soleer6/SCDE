"""Create UI pagination/export fixture only in the synthetic b tenant.

No welcome mail or changes to existing users; credentials stay in runtime.
"""
import json
from pathlib import Path
from uuid import uuid4
from django.db import transaction
from apps.organizations.models.organization import Organization
from apps.accounts.services.user_service import create_user

path = Path('/runtime/fixtures-b-h21-ui.local.json')
if path.exists():
    print('Existing H21 UI fixture preserved.')
else:
    base = json.loads(Path('/runtime/fixtures-b.local.json').read_text())
    org = Organization.objects.get(pk=base['organizationId'])
    tag = f'H21-{uuid4().hex[:8]}'
    def dni(number):
        return f'{number:08d}' + 'TRWAGMYFPDXBNJZSQVHLCKE'[number % 23]
    first_number = int(uuid4().hex[:7], 16) % 80000000 + 10000000
    old_dni, new_dni = dni(first_number), dni(first_number + 1)
    with transaction.atomic():
        for i in range(33):
            user, _password = create_user(organization=org, email=f'{tag.lower()}-{i:02}@scde.local',
                first_name=tag, last_name='Coma, "Texto"' if i == 0 else f'Persona {i:02}',
                nia=f'{tag}-{i:02}', dni=old_dni if i == 0 else '', is_staff=i == 32)
            user.is_active = i == 31
            user.save(update_fields=['is_active'])
    path.write_text(json.dumps({'organizationId': str(org.pk), 'tag': tag, 'count': 31,
        'email': f'{tag.lower()}-00@scde.local', 'nia': f'{tag}-00', 'oldDni': old_dni, 'newDni': new_dni}))
    path.chmod(0o600)
    print('Created 33 synthetic users: 31 matching inactive/non-manager rows plus two controls; no mail.')
