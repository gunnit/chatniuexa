#!/bin/bash
# Auto-lint TypeScript files after edit
if echo "$CLAUDE_FILE_PATH" | grep -qE '\.(ts|tsx)$'; then
  npx eslint --fix "$CLAUDE_FILE_PATH" 2>/dev/null
fi
exit 0
