#!/bin/bash

cd "$(dirname "$0")"
cd ../app/service-core/storage
rm -rf query

DB_TYPE=${1:-postgres}

echo "Generating SQLC code for $DB_TYPE..."

case $DB_TYPE in
  postgres)
    sqlc generate -f sqlc_postgres.yaml
    ;;
  sqlite)
    sqlc generate -f sqlc_sqlite.yaml
    ;;
  *)
    echo "Invalid database type: $DB_TYPE. Please use postgres or sqlite."
    exit 1
    ;;
esac
