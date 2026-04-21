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

  dev)
    echo "Starting DB and Kafka for local development..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db kafka

    echo ""
    echo "Waiting for DB to be ready..."
    until docker compose -f docker-compose.yml -f docker-compose.dev.yml ps db --format json 2>/dev/null | grep -q '"running"'; do
      sleep 2
    done
    echo "DB is ready."

    echo ""
    echo "Waiting for Kafka to be ready..."
    until docker compose -f docker-compose.yml -f docker-compose.dev.yml ps kafka --format json 2>/dev/null | grep -q '"running"'; do
      sleep 2
    done
    echo "Kafka is ready."

    echo ""
    echo "PostgreSQL: localhost:5433 (user: mydict, password: mydict, db: mydict)"
    echo "Kafka:      localhost:9092"
    echo ""
    echo "Run your API and frontend locally now."
    ;;

  stop)
    echo "Stopping all services..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml down
    echo "All services stopped."
    ;;

  logs)
    docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f "${@:2}"
    ;;

  *)
    echo "Usage: $0 {run|dev|stop|logs}"
    exit 1
    ;;
esac
