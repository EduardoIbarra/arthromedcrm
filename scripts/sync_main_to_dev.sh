#!/bin/bash
set -e

MAIN_DB="postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres"
DEV_DB_1="postgresql://postgres:B9124853d8.90@db.zdvkatyzqgbeewtbuyfu.supabase.co:5432/postgres"
DEV_DB_2="postgresql://postgres:Rapido221196.@db.ibcevxzxfzszrmejekqd.supabase.co:5432/postgres"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SCRATCH_DIR="scratch"
mkdir -p "$SCRATCH_DIR"

DUMP_FILE="$SCRATCH_DIR/main_dump_$TIMESTAMP.dump"
DEV1_BACKUP="$SCRATCH_DIR/dev1_backup_$TIMESTAMP.dump"
DEV2_BACKUP="$SCRATCH_DIR/dev2_backup_$TIMESTAMP.dump"

echo "=== 1. Backing up target develop databases ==="
pg_dump "$DEV_DB_1" --schema=public --no-owner --no-privileges -F c -f "$DEV1_BACKUP" || echo "Dev 1 backup warning"
pg_dump "$DEV_DB_2" --schema=public --no-owner --no-privileges -F c -f "$DEV2_BACKUP" || echo "Dev 2 backup warning"

echo "=== 2. Exporting main database public schema & data ==="
pg_dump "$MAIN_DB" --schema=public --no-owner --no-privileges -F c -f "$DUMP_FILE"

echo "=== 3. Overwriting target develop database 1 (zdvkatyzqgbeewtbuyfu) ==="
psql "$DEV_DB_1" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
pg_restore --no-owner --no-privileges -d "$DEV_DB_1" "$DUMP_FILE" || echo "pg_restore finished with warnings"

echo "=== 4. Overwriting target develop database 2 (ibcevxzxfzszrmejekqd) ==="
psql "$DEV_DB_2" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
pg_restore --no-owner --no-privileges -d "$DEV_DB_2" "$DUMP_FILE" || echo "pg_restore finished with warnings"

echo "=== 5. Granting table permissions to anon, authenticated, service_role ==="
GRANT_SQL="
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role, postgres;
"

psql "$DEV_DB_1" -c "$GRANT_SQL"
psql "$DEV_DB_2" -c "$GRANT_SQL"

echo "=== 6. Setting Super Admin privileges ==="
node scripts/set_superadmin.js

echo "=== Database Overwrite & Permission Setup Complete! ==="
