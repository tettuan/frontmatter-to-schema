# Frontmatter-to-Schema Project Overview

## Project Purpose

This is a Deno-based frontmatter-to-schema system that utilizes Claude AI
(`claude -p`) to extract and analyze markdown frontmatter, then transforms it to
structured data using schema-driven templates.

The project follows Domain-Driven Design (DDD), Test-Driven Development (TDD),
and Totality principles with AI-complexity-control.

## Tech Stack

- **Runtime**: Deno (TypeScript/JavaScript)
- **Package Manager**: JSR for packages
- **AI Integration**: Claude CLI (`claude -p` command)
- **Architecture**: DDD with layered architecture
- **Principles**: TDD, Totality, AI-complexity-control

## Core Architecture

### Domain Structure (src/)

```
src/
├── domain/
│   ├── core/ - Core types, interfaces, abstractions (backbone)
│   ├── analysis/ - Schema-driven analysis engine
│   ├── frontmatter/ - Frontmatter extraction and processing
│   ├── pipeline/ - Generic and specific pipelines  
│   ├── prompt/ - Prompt management
│   └── registry/ - Registry building
├── application/
│   ├── climpt/ - Climpt-specific adapter
│   ├── services/ - Application services
│   └── usecases/ - Use case implementations
└── infrastructure/
    └── filesystem/ - File I/O operations
```

### Key Domain Boundaries

1. **Core Domain**: FrontMatter Analysis Domain
   - Generic frontmatter extraction and schema-based analysis
   - Schema-driven template mapping

2. **Supporting Domains**:
   - File Discovery Domain (file pattern matching)
   - AI Analysis Domain (Claude API integration)
   - Registry Building Domain (output formatting)

## Core Abstractions (Backbone)

### Central Types (src/domain/core/types.ts)

- `FilePath` - File path value object
- `FrontMatterContent` - Generic frontmatter container
- `SchemaDefinition<T>` - Generic schema validation
- `SourceFile` - Source file with content and metadata
- `AnalysisResult<T>` - Generic analysis result container
- `AnalysisContext` - Context for analysis pipeline

### Core Interfaces (src/domain/core/interfaces.ts)

- `FrontMatterExtractor` - Frontmatter extraction
- `AnalysisStrategy<TInput, TOutput>` - Generic analysis strategy
- `AnalysisEngine` - Strategy execution engine
- `Transformer<TInput, TOutput>` - Result transformation
- `FileDiscovery` - File discovery and filtering
- `OutputFormatter<T>` - Output format serialization
- `PipelineConfig` - Pipeline configuration

### Abstract Pipeline Architecture (src/domain/core/abstractions.ts)

- `Pipeline<TInput, TOutput>` - Generic pipeline interface
- `AbstractPipeline<TInput, TOutput>` - Base implementation
- `ExtensiblePipeline<TInput, TOutput>` - Hookable pipeline
- `PipelineFactory<TConfig, TPipeline>` - Factory pattern
- `SchemaBasedAnalyzer<TSchema, TResult>` - Schema-driven analysis
- `TemplateMapper<TSource, TTarget>` - Template mapping

## Processing Flow

### Generic Pipeline (src/domain/pipeline/generic-pipeline.ts)

1. **File Discovery**: Find and read markdown files
2. **Frontmatter Extraction**: Extract YAML frontmatter
3. **Schema Analysis**: Use Claude AI for schema-driven analysis
4. **Template Mapping**: Map analysis results to target templates
5. **Registry Building**: Aggregate and format results
6. **Output Generation**: Write final structured output

### Two Analysis Strategies

- **Information Extraction**: Extract structured data from frontmatter using
  schema
- **Template Mapping**: Apply extracted data to target template structure

## Current Usage Patterns

### Main Entry Points

- `src/main.ts` - Original pipeline implementation
- `src/main-redesigned.ts` - New high-abstraction architecture

### Configuration Examples

1. **Climpt Tool Registry** (`.agent/climpt/prompts` → `registry.json`)
2. **Article Books Registry** (`.agent/drafts/articles` → `books.yml`)

## Key Design Principles

### AI-Complexity-Control

- Entropy control: Limit system complexity growth
- Functional gravity: Cohesive functions should be close
- Pattern convergence: Use proven patterns over novel ones

### Totality Principles

- Eliminate partial functions using Result types
- Use discriminated unions instead of optional properties
- Smart constructors for validated value objects
- Comprehensive error handling with typed errors

## Testing and Development Commands

- `./run-tests.sh` - Run test suite
- `deno task ci` - Continuous integration tasks
- `deno task ci:dirty` - CI with dirty working directory
