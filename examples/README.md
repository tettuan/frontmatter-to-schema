# Frontmatter to Schema CLI Examples

This directory contains examples demonstrating how to use the
frontmatter-to-schema CLI tool.

## 🚀 Quick Start

The CLI tool processes markdown files with frontmatter and transforms them
according to schemas and templates:

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
