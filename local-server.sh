#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="127.0.0.1"
PORT="4103"

cd "$PROJECT_DIR"
echo "Starting banik_books at http://$HOST:$PORT"
exec python3 -m http.server "$PORT" --bind "$HOST"
