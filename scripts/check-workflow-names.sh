#!/usr/bin/env bash
# In plain YAML " #" starts a comment, so `name: agent #${{ ... }}` names the job just
# "agent". The run budget of opencode.yml looks jobs up by the full name, and such a name
# silently turns the budget off. A job or step name with " #" must be quoted.
set -euo pipefail

status=0
for file in "$@"; do
  if found=$(grep -nE '^[[:space:]]*(- )?name:[[:space:]]+[^"'"'"'[:space:]][^#]*[[:space:]]#' "$file"); then
    while IFS= read -r line; do
      echo "$file:${line%%:*}: an unquoted name with \" #\" is cut at the comment, quote it"
    done <<< "$found"
    status=1
  fi
done
exit "$status"
