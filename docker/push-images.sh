#!/usr/bin/env bash
# ========================================
# Push Lyrebird images to registry
# ========================================

set -euo pipefail

REGISTRY=${REGISTRY:-"ghcr.io/0-sayed"}
VERSION=${VERSION:-"latest"}

echo "Tagging and pushing images to $REGISTRY..."
echo ""

for service in gateway ingestion analysis; do
    echo "Pushing lyrebird-$service:$VERSION..."
    
    # Verify that the source image with the 'latest' tag exists locally
    if ! docker image inspect "lyrebird-$service:latest" >/dev/null 2>&1; then
        echo "Error: source image lyrebird-$service:latest not found locally."
        echo "Please build it first using: pnpm docker:build"
        exit 1
    fi
    
    docker tag lyrebird-$service:latest $REGISTRY/lyrebird-$service:$VERSION
    docker push $REGISTRY/lyrebird-$service:$VERSION
    echo "  ✓ lyrebird-$service:$VERSION pushed successfully"
done

echo "Push complete!"
