#!/usr/bin/env bash
# ========================================
# Push Lyrebird images to registry
# ========================================

set -euo pipefail

REGISTRY=${REGISTRY:-"ghcr.io/0-sayed"}
VERSION=${VERSION:-"latest"}

echo "Tagging and pushing images to $REGISTRY..."

for service in gateway ingestion analysis; do
    echo "Pushing lyrebird-$service:$VERSION..."
    docker tag lyrebird-$service:latest $REGISTRY/lyrebird-$service:$VERSION
    docker push $REGISTRY/lyrebird-$service:$VERSION
done

echo "Push complete!"
