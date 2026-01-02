#!/usr/bin/env bash
# ========================================
# Check health of all Lyrebird services
# ========================================

set -euo pipefail

echo "Checking Lyrebird service health..."

services=("localhost:3000" "localhost:3001" "localhost:3002")
names=("Gateway" "Ingestion" "Analysis")

all_healthy=true

for i in "${!services[@]}"; do
    if curl -sf "http://${services[$i]}/health" > /dev/null 2>&1; then
        echo "  ${names[$i]}: healthy"
    else
        echo "  ${names[$i]}: unhealthy"
        all_healthy=false
    fi
done

if [ "$all_healthy" = true ]; then
    echo ""
    echo "All services are healthy!"
    exit 0
else
    echo ""
    echo "Some services are unhealthy!"
    exit 1
fi
