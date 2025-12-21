#!/bin/bash
# Quick access to PostgreSQL shell
# Connects directly to the container (no port needed with docker exec)

# Load environment variables
set -a
source "$(dirname "$0")/../.env"
set +a

echo "Connecting to PostgreSQL database: $DATABASE_NAME"
docker exec -it -e PGPASSWORD="$DATABASE_PASSWORD" lyrebird-postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME"
