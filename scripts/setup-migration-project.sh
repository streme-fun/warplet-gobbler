#!/usr/bin/env bash
# Add migration issues to streme-fun project #2, set Status = "fran: todo:", Target date.
# Requires: gh auth refresh -h github.com -s project,read:project
set -euo pipefail

OWNER=streme-fun
PROJECT=2
REPO=streme-fun/warplet-gobbler

# issue_number:target_date (YYYY-MM-DD)
ITEMS=(
  "64:2026-06-17"
  "65:2026-06-17"
  "66:2026-06-17"
  "67:2026-06-17"
  "68:2026-06-17"
  "69:2026-06-17"
  "70:2026-06-21"
  "71:2026-06-24"
)

if ! gh auth status 2>&1 | grep -q "project"; then
  echo "Missing project scope. Run: gh auth refresh -h github.com -s project,read:project"
  exit 1
fi

PROJECT_ID=$(gh project view "$PROJECT" --owner "$OWNER" --format json --jq .id)
echo "Project ID: $PROJECT_ID"

FIELDS_JSON=$(gh project field-list "$PROJECT" --owner "$OWNER" --format json --limit 50)

STATUS_FIELD_ID=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name | test("status"; "i")) | .id' | head -1)
DATE_FIELD_ID=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name | test("target date"; "i")) | .id' | head -1)
FRAN_TODO_OPTION_ID=$(echo "$FIELDS_JSON" | jq -r '
  .fields[]
  | select(.options != null)
  | .options[]
  | select(.name | test("fran.*todo"; "i"))
  | .id' | head -1)

if [[ -z "$STATUS_FIELD_ID" || -z "$DATE_FIELD_ID" || -z "$FRAN_TODO_OPTION_ID" ]]; then
  echo "Could not resolve project fields. Fields:"
  echo "$FIELDS_JSON" | jq '.fields[] | {name, id, options: (.options // [] | map(.name))}'
  exit 1
fi

echo "Status field: $STATUS_FIELD_ID"
echo "Target date field: $DATE_FIELD_ID"
echo "fran: todo option: $FRAN_TODO_OPTION_ID"

for entry in "${ITEMS[@]}"; do
  ISSUE_NUM="${entry%%:*}"
  TARGET_DATE="${entry##*:}"
  ISSUE_URL="https://github.com/$REPO/issues/$ISSUE_NUM"

  echo "--- Issue #$ISSUE_NUM ($TARGET_DATE) ---"

  ADD_JSON=$(gh project item-add "$PROJECT" --owner "$OWNER" --url "$ISSUE_URL" --format json 2>/dev/null || true)
  ITEM_ID=$(echo "$ADD_JSON" | jq -r '.id // empty')

  if [[ -z "$ITEM_ID" ]]; then
    ITEM_ID=$(gh project item-list "$PROJECT" --owner "$OWNER" --format json --limit 100 \
      | jq -r --arg url "$ISSUE_URL" '.items[] | select(.content.url == $url) | .id' | head -1)
  fi

  if [[ -z "$ITEM_ID" ]]; then
    echo "ERROR: could not find project item for $ISSUE_URL"
    exit 1
  fi

  gh project item-edit \
    --id "$ITEM_ID" \
    --project-id "$PROJECT_ID" \
    --field-id "$STATUS_FIELD_ID" \
    --single-select-option-id "$FRAN_TODO_OPTION_ID"

  gh project item-edit \
    --id "$ITEM_ID" \
    --project-id "$PROJECT_ID" \
    --field-id "$DATE_FIELD_ID" \
    --date "$TARGET_DATE"

  echo "OK: #$ISSUE_NUM → fran: todo, $TARGET_DATE"
done

echo "Done. View: https://github.com/orgs/$OWNER/projects/$PROJECT/views/1"
