# Frontmatter to Schema Examples

This directory contains executable examples demonstrating how to use the
frontmatter-to-schema system.

## 🚀 Running Examples

All examples can be run directly from the terminal:

```bash
# Run specific example
deno run --allow-read --allow-write examples/01-build-registry.ts

# Or make executable and run
chmod +x examples/*.ts
./examples/01-build-registry.ts
```

## 📚 Available Examples

### 01-build-registry.ts

Builds a command registry by scanning climpt prompt files.

**Features:**

- Scans `.agent/climpt/prompts/` directory
- Extracts command structure from file paths
- Detects available options from file content
- Generates markdown report

**Usage:**

```bash
deno run --allow-read --allow-write examples/01-build-registry.ts
```

**Output:** `examples/output/command-registry.md`

---

### 02-parse-frontmatter.ts

Demonstrates frontmatter extraction and parsing from markdown files.

**Features:**

- Parses YAML frontmatter from markdown
- Extracts command metadata
- Shows configuration options
- Generates command structure

**Usage:**

```bash
deno run --allow-read examples/02-parse-frontmatter.ts
```

**Output:** Console output showing parsed data

---

### 03-create-registry.ts

Creates a complete MCP registry with sample commands.

**Features:**

- Uses RegistryAggregator to create registry
- Adds multiple command entries
- Validates registry structure
- Saves to JSON file

**Usage:**

```bash
deno run --allow-read --allow-write examples/03-create-registry.ts
```

**Output:** `examples/output/sample-registry.json`

## 📁 Output Directory

Generated files are saved to `examples/output/`:

- `command-registry.md` - Command registry report
- `sample-registry.json` - MCP registry file

## 🔧 Requirements

- Deno runtime
- Read/Write permissions for file operations

## 💡 Tips

1. **Permissions**: Use `--allow-read` and `--allow-write` flags as needed
2. **Debugging**: Add `--inspect` flag to enable debugging
3. **Watch Mode**: Use `--watch` flag for development

```bash
# Development mode with auto-reload
deno run --watch --allow-read --allow-write examples/01-build-registry.ts
```

## 📖 Learn More

See the main project documentation for:

- [Domain Design](../docs/domain-design.md)
- [Requirements Analysis](../docs/requirements-analysis.md)
- [Production Roadmap](../docs/production-roadmap.md)
