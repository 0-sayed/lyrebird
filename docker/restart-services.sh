#!/bin/bash
# Restart all infrastructure services

echo "🔄 Restarting all services..."
docker compose down
docker compose up -d

echo "⏳ Waiting for services to be healthy..."
sleep 10

echo "✅ Services restarted!"
docker compose ps
