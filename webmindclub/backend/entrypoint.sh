#!/bin/sh
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput >/dev/null
# Optional: seed the demo workspace for an existing user (see README).
if [ -n "$DEMO_OWNER_EMAIL" ]; then
  python manage.py seed_demo --owner-email "$DEMO_OWNER_EMAIL" || echo "Demo seed skipped: create the user first."
fi
exec "$@"
