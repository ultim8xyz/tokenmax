#!/bin/sh
# Runs the SQL contracts against the hosted database.
#
#   opx run --env-file=supabase/tests/pat.env -- supabase/tests/run.sh
#
# psql is the documented way to run these and stays the better one — it reads
# the \set lines natively. This exists because the Supabase Management API is
# reachable without a Postgres client installed, and it is the same endpoint the
# migrations go through.
#
# Every file wraps itself in begin/rollback, and the API honours that, so this
# leaves nothing behind. It is still a write transaction against production: it
# takes brief locks on auth.users, profiles and device_usage.
#
# Needs SUPABASE_PAT in the environment. Never inline it — it is a token.

set -e

PROJECT_REF="${SUPABASE_PROJECT_REF:-exctmspjcaezrsnahkcw}"
DIR=$(dirname "$0")
STATUS=0

for name in rollup rls windows; do
  file="$DIR/$name.sql"

  # \set assignments become literals, and \-prefixed meta-commands are dropped.
  # Substitution is whitelisted to the names actually declared, so `::numeric`
  # and a `T09:00Z` timestamp are left alone.
  body=$(python3 - "$file" <<'PY'
import re, sys

src = open(sys.argv[1]).read()
names = {}
kept = []
for line in src.split("\n"):
    m = re.match(r"\\set\s+(\w+)\s+'([^']*)'\s*$", line)
    if m:
        names[m.group(1)] = m.group(2)
    elif not line.startswith("\\"):
        kept.append(line)

body = "\n".join(kept)
for k, v in names.items():
    body = body.replace(f":'{k}'", f"'{v}'")
    body = re.sub(rf"(?<!:):{k}\b", f"'{v}'", body)

print(body)
PY
)

  result=$(python3 -c "
import json, sys
print(json.dumps({'query': sys.stdin.read()}))
" <<EOF | curl -s -X POST \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_PAT" \
    -H "Content-Type: application/json" \
    --data-binary @-
$body
EOF
)

  # A raised assertion comes back as a JSON object with a message; a clean run
  # comes back as an array.
  case "$result" in
    \[*) echo "ok    $name" ;;
    *)   echo "FAIL  $name"
         # strict=False: a raised assertion carries a literal newline before
         # its CONTEXT line, which strict JSON rejects.
         echo "$result" | python3 -c "import json,sys; print('     ', json.loads(sys.stdin.read(), strict=False).get('message','').strip().replace(chr(10), chr(10)+'      '))"
         STATUS=1 ;;
  esac
done

exit $STATUS
