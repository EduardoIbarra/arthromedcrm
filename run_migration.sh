echo "Waiting 320 seconds for circuit breaker to clear..."
sleep 320
echo "Attempting pg_dump -> psql..."
pg_dump "postgresql://postgres.ibcevxzxfzszrmejekqd:Rapido221196.@aws-0-us-west-2.pooler.supabase.com:6543/postgres" \
  --schema=public \
  --no-owner \
  --no-privileges | psql "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres" > /tmp/migration2_output.log 2>&1
echo "Migration exit code: $?" >> /tmp/migration2_output.log
