#!/bin/sh
set -e

# Docker named volumes are mounted as root:root by the daemon.
# Fix ownership of the documents data directory before dropping privileges.
chown -R app:app /data 2>/dev/null || true

# Drop from root → app and exec the requested command.
exec gosu app "$@"
