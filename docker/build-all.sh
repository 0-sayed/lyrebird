#!/usr/bin/env bash
# ========================================
# Build all Lyrebird Docker images
# ========================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Function to check if a Docker image exists
check_image_exists() {
  local image="$1"
  
  if ! docker image inspect "$image" > /dev/null 2>&1; then
    echo "Error: Docker image $image was not created." >&2
    return 1
  fi
  echo "  $image - OK"
}

echo "Building Lyrebird Docker images..."
echo ""

# Build all services using docker-compose (more maintainable)
echo "Building all services defined in docker-compose.prod.yml..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

echo ""
echo "Verifying images were created successfully..."

# Verify all expected images exist
SERVICES=("lyrebird-gateway" "lyrebird-ingestion" "lyrebird-analysis")
all_images_exist=true

for service in "${SERVICES[@]}"; do
  if ! check_image_exists "${service}:latest"; then
    all_images_exist=false
  fi
done

if [ "$all_images_exist" = false ]; then
  echo ""
  echo "Error: Some images failed to build. Check the output above." >&2
  exit 1
fi

echo ""
echo "Build complete! Image sizes:"
docker images | grep lyrebird | head -5

echo ""
echo "To run the full stack:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
