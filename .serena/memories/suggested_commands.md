# Essential Development Commands

## Core Workflow
```bash
# Test & CI
./run-tests.sh
deno task ci

# Main execution
deno run --allow-read --allow-write --allow-run src/main.ts .agent/climpt/prompts

# Code quality
deno fmt && deno lint
```

## Git Essentials
```bash
git status
git add . && git commit -m "message"
git push
```

## File Operations
```bash
# Search
rg "pattern" directory/
find . -name "*.md" -type f

# Navigation
ls -la
cd path/
```

## Claude AI
```bash
# Direct analysis
claude -p prompt-file.md < input-file
```

## Debugging
```bash
# Permissions
--allow-read --allow-write --allow-run --allow-env --allow-net

# Check versions
deno --version
claude --version
```