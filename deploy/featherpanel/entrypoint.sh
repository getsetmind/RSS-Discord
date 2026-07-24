#!/bin/bash
set -euo pipefail

mkdir -p /home/container/data /home/container/logs

echo "Bun $(bun --version)"
echo "RSS Discord data directory: /home/container/data"

MODIFIED_STARTUP=$(eval echo "$(echo "${STARTUP:-bun /opt/rss-discord/cli.js}" | sed -e 's/{{/${/g' -e 's/}}/}/g')")
echo ":/home/container$ ${MODIFIED_STARTUP}"

exec bash -lc "${MODIFIED_STARTUP}"
