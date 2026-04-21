#!/bin/bash

cd "$(dirname "$0")"

case "$1" in
  run)
    echo "Building and starting all services..."
    docker compose up -d --build

    echo ""
    echo "Waiting for Kafka to be ready..."
    until docker compose ps kafka --format json 2>/dev/null | grep -q '"running"'; do
      sleep 2
    done
    echo "Kafka is ready."

    echo ""
    echo "Waiting for Flyway migrations to complete..."
    # Flyway runs once and exits — wait for it to finish
    docker compose wait flyway 2>/dev/null || true
    echo "Flyway migrations done."
    docker compose logs flyway 2>&1 | tail -5

    echo ""
    echo "Waiting for API to be ready..."
    until docker compose ps api --format json 2>/dev/null | grep -q '"running"'; do
      sleep 2
    done
    sleep 2

    echo ""
    echo "App is running at http://localhost:3000"
    echo "API is running at http://localhost:3001"
    echo "Kafka is running at localhost:9092"
    ;;

  stop)
    echo "Stopping all services..."
    docker compose down
    echo "All services stopped."
    ;;

  migrate)
    echo "Running Flyway migrations..."
    docker compose up flyway
    echo "Migrations complete."
    ;;

  logs)
    docker compose logs -f "${@:2}"
    ;;

  *)
    echo "Usage: $0 {run|stop|migrate|logs}"
    exit 1
    ;;
esac
