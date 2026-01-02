#!/usr/bin/env bash
# ========================================
# Build all Lyrebird Docker images
# ========================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "Building Lyrebird Docker images..."

# Build using individual Dockerfiles
echo "Building gateway..."
docker build -t lyrebird-gateway:latest -f apps/gateway/Dockerfile .

echo "Building ingestion..."
docker build -t lyrebird-ingestion:latest -f apps/ingestion/Dockerfile .

echo "Building analysis..."
docker build -t lyrebird-analysis:latest -f apps/analysis/Dockerfile .

echo ""
echo "Build complete! Image sizes:"
docker images | grep lyrebird | head -5

echo ""
echo "To run the full stack:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
