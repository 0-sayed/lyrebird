#!/bin/bash
# ⚠️  WARNING: This will delete ALL data!

read -p "⚠️  This will delete all data. Are you sure? (y/n): " confirm

if [ "$confirm" = "y" ]; then
    echo "🗑️  Stopping services..."
    docker compose down -v

    echo "🧹 Removing volumes..."
    docker volume rm lyrebird_postgres_data 2>/dev/null || true
    docker volume rm lyrebird_rabbitmq_data 2>/dev/null || true
    docker volume rm lyrebird_redis_data 2>/dev/null || true

    echo "✅ All data cleared!"
else
    echo "❌ Cancelled"
fi
