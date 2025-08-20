# Frontmatter to Schema CLI Examples

This directory contains examples demonstrating how to use the frontmatter-to-schema CLI tool.

## 🚀 Quick Start

The CLI tool processes markdown files with frontmatter and transforms them according to schemas and templates:

```bash
# Basic usage
frontmatter-to-schema <directory> --schema=<file> --template=<file> --destination=<dir>

# Example
frontmatter-to-schema examples/sample-docs \
  --schema=examples/articles-index/schema.json \
  --template=examples/articles-index/template.yaml \
  --destination=examples/output
```

## 📚 CLI Examples

### 01-cli-basic.sh

Basic CLI usage examples demonstrating common use cases.

**Features:**
- Process with configuration file
- Process articles with YAML template
- Display help information

**Usage:**
```bash
chmod +x examples/01-cli-basic.sh
./examples/01-cli-basic.sh
```

---

### 02-cli-advanced.sh

Advanced CLI usage patterns including batch processing and error handling.

**Features:**
- Process multiple directories
- Custom output formats
- Error handling strategies
- Batch processing with validation

**Usage:**
```bash
chmod +x examples/02-cli-advanced.sh
./examples/02-cli-advanced.sh
```

---

### 03-cli-programmatic.ts

Demonstrates programmatic usage of the CLI from TypeScript/JavaScript.

**Features:**
- Execute CLI from TypeScript
- Process multiple configurations
- Handle errors programmatically
- Generate summary reports

**Usage:**
```bash
deno run --allow-read --allow-write --allow-run examples/03-cli-programmatic.ts
```

## 📂 Legacy Examples (Programmatic API)

The following examples demonstrate direct API usage (without CLI):

### 01-build-registry.ts
Builds a command registry by scanning climpt prompt files.

```bash
deno run --allow-read --allow-write examples/01-build-registry.ts
```

### 02-parse-frontmatter.ts
Demonstrates frontmatter extraction and parsing from markdown files.

```bash
deno run --allow-read examples/02-parse-frontmatter.ts
```

### 03-create-registry.ts
Creates a complete MCP registry with sample commands.

```bash
deno run --allow-read --allow-write examples/03-create-registry.ts
```

### 04-complete-flow.ts
Demonstrates the complete document processing pipeline.

```bash
deno run --allow-read --allow-write --allow-env --allow-run examples/04-complete-flow.ts
```

### 05-climpt-registry.ts
Processes climpt prompts to generate registry.

```bash
deno run --allow-read --allow-write --allow-env --allow-run examples/05-climpt-registry.ts
```

### 06-redesigned-architecture.ts
Demonstrates the redesigned DDD architecture.

```bash
deno run --allow-read --allow-write --allow-env --allow-run examples/06-redesigned-architecture.ts
```

### 07-configuration-flexibility.ts
Shows configuration flexibility and schema variability.

```bash
deno run --allow-read --allow-write --allow-env --allow-run examples/07-configuration-flexibility.ts
```

## 📁 Sample Data

### Input Directories
- `sample-docs/` - Sample markdown documents
- `alternative-structure/` - Alternative command structure
- `.agent/climpt/prompts/` - Climpt prompt files

### Configuration Files
- `climpt-registry/` - Climpt registry configuration
  - `schema.json` - JSON schema for validation
  - `template.json` - Output template
  - `config.json` - Processing configuration
- `articles-index/` - Articles indexing configuration
  - `schema.json` - Article schema
  - `template.yaml` - YAML output template

### Output Directory
- `output/` - Generated files from examples
  - `*.json` - JSON output files
  - `*.yaml` - YAML output files
  - `*.md` - Markdown reports

## 🔧 Requirements

- Deno runtime
- CLI executable: `./frontmatter-to-schema`
- Read/Write permissions for file operations

## 💡 Tips

1. **Make CLI executable**: 
   ```bash
   chmod +x frontmatter-to-schema
   ```

2. **View help**:
   ```bash
   ./frontmatter-to-schema --help
   ```

3. **Debug mode**:
   ```bash
   FRONTMATTER_DEBUG=1 ./frontmatter-to-schema <args>
   ```

4. **Watch mode** (for development):
   ```bash
   deno run --watch --allow-all cli.ts <args>
   ```

## 📖 Documentation

- [CLI Usage Guide](../docs/cli-usage.md)
- [Domain Design](../docs/domain/domain-design.md)
- [Production Roadmap](../docs/production-roadmap.md)

## 🧪 Testing

Run all examples:
```bash
./examples/run-all.sh
```

## 📝 License

See the main project LICENSE file.