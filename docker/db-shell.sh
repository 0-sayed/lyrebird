#!/bin/bash
# Quick access to PostgreSQL shell
# Connects directly to the container (no port needed with docker exec)

docker exec -it -e PGPASSWORD=postgres lyrebird-postgres psql -U postgres -d lyrebird
