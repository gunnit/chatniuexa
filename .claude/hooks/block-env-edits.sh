#!/bin/bash
# Block edits to .env files to prevent accidental secret exposure
if echo "$CLAUDE_FILE_PATH" | grep -qE '\.env($|\.)'; then
  echo "BLOCK: Do not edit .env files — manage secrets via Render dashboard"
  exit 2
fi
exit 0
