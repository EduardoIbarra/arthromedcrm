#!/bin/bash

# Arthromed Database Migration Script
# This script copies the public schema and data from the secondary database to the main database.

SOURCE_DB="postgresql://postgres.ibcevxzxfzszrmejekqd:Rapido221196.@aws-0-us-west-2.pooler.supabase.com:6543/postgres"
DEST_DB="postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres"

echo "Starting migration from secondary database to the main database..."
echo "This will merge the unique schemas."

# Dump the public schema without owners/privileges and pipe directly into the main database
pg_dump "$SOURCE_DB" --schema=public --no-owner --no-privileges | psql "$DEST_DB"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
else
    echo ""
    echo "❌ Migration encountered an error. Please review the output above."
fi
