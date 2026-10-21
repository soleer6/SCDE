"""Real backend settings for a loopback-only development environment.

Imports the actual base settings, without optional ERD/debug-toolbar apps or
changing any business services, database engine, storage or authentication.
"""
from scdee.settings.base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']
SECURE_SSL_REDIRECT = False
LOGGING['handlers']['console']['formatter'] = 'simple'  # noqa: F405
