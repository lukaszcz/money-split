#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  prlog.sh -t "type: short pr subject" [-F FILE.md]

Options:
  -t  PR title (required). Format: "type: short pr subject"
  -F  Body/description markdown file (default: PR.md)

Behavior:
  1) Creates a draft PR using the title and the file as the body
  2) Moves the file to docs/history/pr_<N>_<slug>.md, commits it
  3) Pushes the commit

Guards:
  - Fails if working tree or index is not clean before starting.
EOF
}

TITLE=""
FILE="PR.md"

while getopts ":t:F:h" opt; do
  case "$opt" in
    t) TITLE="$OPTARG" ;;
    F) FILE="$OPTARG" ;;
    h) usage; exit 0 ;;
    \?) echo "Unknown option: -$OPTARG" >&2; usage; exit 2 ;;
    :) echo "Missing argument for -$OPTARG" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "${TITLE}" ]]; then
  echo "Error: -t is required." >&2
  usage
  exit 2
fi

if [[ ! -f "${FILE}" ]]; then
  echo "Error: file not found: ${FILE}" >&2
  exit 2
fi

# --- Guard: repo must be clean (no unstaged changes, no staged changes) ---
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository." >&2
  exit 2
fi

if ! git diff --quiet; then
  echo "Error: working tree has unstaged changes. Commit/stash them first." >&2
  exit 1
fi

if ! git diff --cached --quiet; then
  echo "Error: index has staged changes. Commit/stash them first." >&2
  exit 1
fi
# ------------------------------------------------------------------------

# Extract the "type" and the "short pr subject" from "type: short pr subject"
TYPE="$(printf '%s' "$TITLE" | sed -E 's/^([^:]+):.*$/\1/')"
SUBJECT="$(printf '%s' "$TITLE" | sed -E 's/^[^:]+:[[:space:]]*//')"

if [[ -z "${SUBJECT}" || "$SUBJECT" == "$TITLE" ]]; then
  echo "Error: could not parse subject from title. Expected 'type: short pr subject'." >&2
  exit 2
fi

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//; s/_+/_/g'
}

first_word() {
  # Lowercased first token of SUBJECT, stripped of leading/trailing punctuation/underscores.
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | awk '{print $1}' \
    | sed -E 's/^[^a-z0-9]+//; s/[^a-z0-9]+$//'
}

SLUG="$(slugify "$SUBJECT")"
if [[ -z "${SLUG}" ]]; then
  SLUG="pr"
fi

# Rule: for fix: subject and fix(...): subject, if subject doesn't start with fix/fixed, prefix slug with fix_
TYPE_LC="$(printf '%s' "$TYPE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[[:space:]]+//g')"
if [[ "$TYPE_LC" == fix* ]]; then
  FW="$(first_word "$SUBJECT")"
  if [[ "$FW" != "fix" && "$FW" != "fixed" ]]; then
    SLUG="fix_${SLUG}"
  fi
fi

CURRENT_BRANCH="$(git branch --show-current)"

if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "Could not determine current branch"
  exit 1
fi

# Ensure upstream exists
if ! git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
  echo "Pushing branch to origin..."
  git push -u origin "$CURRENT_BRANCH"
fi

PR_URL="$(gh pr create \
  --draft \
  --head "$CURRENT_BRANCH" \
  --title "$TITLE" \
  --body-file "$FILE")"

PR_NUMBER="$(gh pr view "$PR_URL" --json number --jq .number)"

DEST_DIR="docs/history"
DEST_PATH="${DEST_DIR}/pr_${PR_NUMBER}_${SLUG}.md"
mkdir -p "$DEST_DIR"

# Prepend title
TMP="$(mktemp)"
{
  printf '# %s\n\n' "$TITLE"
  cat "$FILE"
} > "$TMP"

if git ls-files --error-unmatch "$FILE" >/dev/null 2>&1; then
  git rm "$FILE"
else
  rm "$FILE"
fi

mv "$TMP" "$DEST_PATH"
git add "$DEST_PATH"

git commit -m "docs(history): add PR ${PR_NUMBER} notes"
git push

echo "Done."
echo "PR:   $PR_URL"
echo "File: $DEST_PATH"
