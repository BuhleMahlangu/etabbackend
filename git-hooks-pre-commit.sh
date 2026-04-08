#!/bin/sh
# Pre-commit hook to prevent committing .env files and secrets

echo "Running pre-commit checks..."

# Check for .env files
if git diff --cached --name-only | grep -E "\.env$|\.env\.local$|\.env\.production$" > /dev/null 2>&1; then
    echo "❌ ERROR: Attempting to commit .env file!"
    echo "🛑 Commit blocked for security."
    echo ""
    echo "To fix:"
    echo "  1. Run: git rm --cached <env-file>"
    echo "  2. Add .env to .gitignore"
    echo "  3. Commit again"
    exit 1
fi

# Check for secrets.txt files
if git diff --cached --name-only | grep -E "secrets.*\.txt$|\.secrets" > /dev/null 2>&1; then
    echo "❌ ERROR: Attempting to commit secrets file!"
    echo "🛑 Commit blocked for security."
    exit 1
fi

# Check for potential hardcoded secrets in code
if git diff --cached -U0 | grep -iE "apikey|api_key|apikey|secret.*=.*[^${}]|password.*=.*[^${}]" | grep -v "// " | grep -v "/* " > /dev/null 2>&1; then
    echo "⚠️  WARNING: Possible hardcoded secrets detected"
    echo "Please review the staged changes for sensitive data"
    echo "If these are not secrets, use: git commit --no-verify"
fi

echo "✅ Pre-commit checks passed!"
exit 0
