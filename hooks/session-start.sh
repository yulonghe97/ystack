#!/bin/bash
# ystack session start — shows project status on session start

# Check for ystack project
if [ ! -f "ystack.config.json" ]; then
  exit 0
fi

echo "[ystack] Project detected"

# Show Beads ready front
if [ -d ".beads" ] && command -v bd &> /dev/null; then
  READY=$(bd ready --json 2>/dev/null | head -5)
  if [ -n "$READY" ]; then
    echo ""
    echo "Ready to work on:"
    bd ready 2>/dev/null | head -10
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
