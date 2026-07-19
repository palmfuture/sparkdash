#!/bin/bash
# Deploy / refresh sparkDash with minimal rebuilds.
#
# Usage:
#   ./deploy.sh           # start/recreate container (no image rebuild)
#   ./deploy.sh --build   # rebuild image (deps / Dockerfile / first install)
#   ./deploy.sh --frontend  # build frontend on host then recreate (dist is mounted)

set -euo pipefail
cd "$(dirname "$0")"

BUILD=0
FRONTEND=0
for arg in "$@"; do
  case "$arg" in
    --build|-b) BUILD=1 ;;
    --frontend|-f) FRONTEND=1 ;;
    --help|-h)
      echo "Usage: $0 [--build] [--frontend]"
      exit 0
      ;;
  esac
done

if [[ "$FRONTEND" -eq 1 ]]; then
  echo "Building frontend (host) → dist/ (mounted into container)..."
  npm run build
fi

if [[ "$BUILD" -eq 1 ]]; then
  echo "Building image..."
  docker compose build
  echo "Recreating container..."
  docker compose up -d --force-recreate
else
  echo "Starting container (no image rebuild)..."
  # Apply compose changes (command, volumes) without rebuilding the image
  docker compose up -d --force-recreate
fi

echo "Done. Dashboard: http://localhost:5555"
echo ""
echo "Day-to-day (no docker rebuild needed):"
echo "  • Server code:  edit server/*  → node --watch reloads automatically"
echo "  • Frontend:     npm run build  → refresh browser (dist is bind-mounted)"
echo "  • Only rebuild image when package.json / Dockerfile changes: ./deploy.sh --build"
