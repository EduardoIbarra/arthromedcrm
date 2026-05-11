while true; do
  psql "postgresql://postgres.ibcevxzxfzszrmejekqd:Rapido221196.@aws-0-us-west-2.pooler.supabase.com:6543/postgres" -c "SELECT 1;" >/dev/null 2>&1
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 0 ]; then
    echo "Success!"
    break
  fi
  # Check if it's still circuit breaker or auth failure
  OUTPUT=$(psql "postgresql://postgres.ibcevxzxfzszrmejekqd:Rapido221196.@aws-0-us-west-2.pooler.supabase.com:6543/postgres" -c "SELECT 1;" 2>&1)
  if [[ $OUTPUT != *"ECIRCUITBREAKER"* ]]; then
    echo "Breaker cleared. Status: $OUTPUT"
    break
  fi
  echo "Still blocked..."
  sleep 10
done
