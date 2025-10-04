#!/bin/sh
# Wait for RabbitMQ to be ready
# This script waits for RabbitMQ to be fully ready before starting the service

set -e

host="$1"
shift
cmd="$@"

until nc -z "$host" 5672; do
  >&2 echo "RabbitMQ is unavailable - waiting..."
  sleep 2
done

>&2 echo "RabbitMQ port is open - checking if ready..."

# Additional wait to ensure RabbitMQ is fully initialized
# This helps prevent ECONNREFUSED errors during startup
sleep 5

>&2 echo "RabbitMQ is ready - starting service"
exec $cmd
