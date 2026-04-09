#!/bin/bash
# ystack session start — shows project status on session start

# Check for ystack project
if [ ! -f ".ystack/config.json" ]; then
  exit 0
fi

echo "[ystack] Project detected"

# Show ready front from progress files
if [ -d ".ystack/progress" ]; then
  # Count unchecked items across all progress files
  UNCHECKED=$(grep -r '^\- \[ \]' .ystack/progress/*.md 2>/dev/null | head -10)
  if [ -n "$UNCHECKED" ]; then
    echo ""
    echo "Ready to work on:"
    grep -r '^\- \[ \]' .ystack/progress/*.md 2>/dev/null | head -10 | while read -r line; do
      FILE=$(echo "$line" | cut -d: -f1 | xargs basename | sed 's/\.md$//')
      FEATURE=$(echo "$line" | sed 's/.*\- \[ \] //' | sed 's/  *→.*//')
      echo "  $FILE — $FEATURE"
    done
  fi
fi

# Check for in-progress plans
if [ -d ".context" ]; then
  PLANS=$(find .context -name "PLAN.md" -maxdepth 2 2>/dev/null)
  if [ -n "$PLANS" ]; then
    echo ""
    echo "In-progress plans:"
    for plan in $PLANS; do
      FEATURE=$(dirname "$plan" | xargs basename)
      TITLE=$(head -1 "$plan" | sed 's/^# //')
      echo "  $FEATURE — $TITLE"
    done
    echo ""
    echo "Run /go to continue, or /build for new work."
  fi
fi
