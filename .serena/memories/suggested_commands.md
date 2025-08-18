# Suggested Commands for Development

## Core Development Commands

### Testing
```bash
# Run all tests
./run-tests.sh

# Run specific test files
deno test test/test-extractor.ts --allow-read
deno test test/test-registry-builder.ts

# Run tests with coverage (if configured)
deno test --coverage
```

### Main Application Execution
```bash
# Original pipeline
deno run --allow-read --allow-write --allow-run src/main.ts .agent/climpt/prompts

# Redesigned high-abstraction pipeline  
deno run --allow-read --allow-write --allow-run src/main-redesigned.ts .agent/climpt/prompts .agent/climpt/registry.json

# Advanced example with custom config
deno run --allow-read --allow-write --allow-run src/main-redesigned.ts .agent/climpt/prompts --demo-advanced
```

### CI/CD Tasks
```bash
# Standard CI pipeline
deno task ci

# CI with dirty working directory (development)
deno task ci:dirty
```

## File and Directory Operations (Darwin/macOS)

### Basic Commands
```bash
# List directory contents
ls -la [directory]

# Change directory
cd [path]

# Create directory
mkdir -p [directory]

# Copy files
cp [source] [destination]

# Move/rename files
mv [source] [destination]

# Remove files/directories
rm -rf [path]
```

### Search and Analysis
```bash
# Find files by pattern
find [directory] -name "*.md" -type f

# Search content in files (prefer ripgrep if available)
rg "pattern" [directory]
# or traditional grep
grep -r "pattern" [directory]

# Count lines in files
wc -l [file]

# Show file statistics
stat [file]
```

## Git Commands
```bash
# Check repository status
git status

# Add changes
git add [files]

# Commit changes
git commit -m "message"

# Push changes  
git push

# Pull changes
git pull

# Create branch
git checkout -b [branch-name]

# Switch branch
git checkout [branch-name]

# View commit history
git log --oneline

# View differences
git diff
git diff --cached
```

## Deno-Specific Commands

### Development
```bash
# Format code
deno fmt

# Lint code
deno lint

# Type check
deno check [file.ts]

# Install dependencies
deno cache [file.ts]

# Update dependencies
deno cache --reload [file.ts]
```

### Permissions
```bash
# Common permission combinations
--allow-read          # Read file system
--allow-write         # Write file system  
--allow-run           # Run subprocesses
--allow-env           # Access environment variables
--allow-net           # Network access

# All permissions (for development)
--allow-all
```

## Claude AI Integration

### Claude CLI Commands
```bash
# Analyze with prompt file
claude -p [prompt-file.md] < [input-file]

# Direct analysis
claude "your prompt here" < [input-file]

# Analyze frontmatter
claude -p scripts/prompts/extract_frontmatter.md < [markdown-file]

# Map to schema
claude -p scripts/prompts/map_to_schema.md < [analysis-result]
```

## Project-Specific Utilities

### Example Execution
```bash
# Run examples (if available)
cd examples/
deno run --allow-read --allow-write --allow-run example1.ts

# Validate registry output
cat .agent/climpt/registry.json | json_pp  # Pretty print JSON
```

### Schema Validation
```bash
# Validate JSON schema (if schema validator is available)
ajv validate -s [schema.json] -d [data.json]

# Manual validation with jq
cat [data.json] | jq '.' # Validate JSON syntax
```

### Development Workflow
```bash
# 1. Make changes
# 2. Run tests
./run-tests.sh

# 3. Format and lint
deno fmt && deno lint

# 4. Test main functionality
deno run --allow-read --allow-write --allow-run src/main-redesigned.ts .agent/climpt/prompts

# 5. Commit changes
git add . && git commit -m "description"
```

## Troubleshooting Commands

### File Permission Issues
```bash
# Check file permissions
ls -la [file]

# Change permissions
chmod +x [file]        # Make executable
chmod 644 [file]       # Read/write for owner, read for others
```

### Debugging
```bash
# Verbose output
deno run --allow-all --log-level=debug [file.ts]

# Enable stack traces
deno run --allow-all --v8-flags=--trace [file.ts]

# Check Deno version
deno --version

# Check Claude CLI
claude --version
which claude
```

### Network and Environment
```bash
# Check environment variables
env | grep -i claude
env | grep -i anthropic

# Test network connectivity
curl -I https://api.anthropic.com

# Check DNS resolution
nslookup api.anthropic.com
```