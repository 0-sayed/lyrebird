#!/usr/bin/env bash
# ========================================
# Check health of all Lyrebird services
# ========================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source .env file if it exists to get actual port configuration
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -o allexport
    source "$PROJECT_ROOT/.env"
    set +o allexport
fi

# Use environment variables with sensible defaults
GATEWAY_PORT="${GATEWAY_PORT:-3000}"
INGESTION_PORT="${INGESTION_PORT:-3001}"
ANALYSIS_PORT="${ANALYSIS_PORT:-3002}"

echo "Checking Lyrebird service health..."
echo "Ports: Gateway=$GATEWAY_PORT, Ingestion=$INGESTION_PORT, Analysis=$ANALYSIS_PORT"
echo ""

services=("localhost:${GATEWAY_PORT}" "localhost:${INGESTION_PORT}" "localhost:${ANALYSIS_PORT}")
names=("Gateway" "Ingestion" "Analysis")

all_healthy=true

for i in "${!services[@]}"; do
    if curl -f "http://${services[$i]}/health" > /dev/null 2>&1; then
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
