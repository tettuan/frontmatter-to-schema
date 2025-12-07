# Documentation Structure

## Quick Navigation

### Getting Started (Conceptual)

- **[Transformation Model](./concepts/transformation-model.md)**: Core concept
  of the x-\* directive transformation language
- **[Directive Selection Guide](./guides/directive-selection.md)**: Which
  directives to use for your use case

### Reference

- **[Schema Extensions Reference](./schema-extensions.md)**: Complete x-\*
  directive syntax and examples
- **[Troubleshooting Guide](./troubleshooting.md)**: Common issues and debugging

### Processing Flow (Japanese)

- **[flow.ja.md](./flow.ja.md)**: Detailed processing flow explanation with
  sub-module responsibilities

---

## Directory Structure

### `/concepts/`

- **[transformation-model.md](./concepts/transformation-model.md)**: Conceptual
  overview of the transformation pipeline

### `/guides/`

- **[directive-selection.md](./guides/directive-selection.md)**: Decision flow
  for choosing x-\* directives

### `/architecture/`

- **[README.md](./architecture/README.md)**: Architectural overview and
  implementation requirements
- **[schema-directives-specification.md](./architecture/schema-directives-specification.md)**:
  8-stage processing order specification
- **[template-processing-specification.md](./architecture/template-processing-specification.md)**:
  Template processing system specification
- **[design-principles.md](./architecture/design-principles.md)**: Core design
  principles and governance framework
- **[canonical-processing-paths.md](./architecture/canonical-processing-paths.md)**:
  Definitive processing paths and rules
- **[root-cause-analysis.md](./architecture/root-cause-analysis.md)**:
  Architectural analysis and learning principles

### `/development/`

- **[ai-complexity-control.md](./development/ai-complexity-control.md)**: AI
  complexity management strategies
- **[totality.md](./development/totality.md)**: Totality principle
  implementation guide
- **[prohibit-hardcoding.ja.md](./development/prohibit-hardcoding.ja.md)**:
  Hardcoding prevention (Japanese)

### `/tests/`

- **[README.md](./tests/README.md)**: Testing strategy overview
- **[testing_guidelines.md](./tests/testing_guidelines.md)**: TDD practices and
  implementation guide

### `/testing/`

- **[comprehensive-test-strategy.md](./testing/comprehensive-test-strategy.md)**:
  Overall testing approach

### `/test-specifications/`

- **[schema-matching-test-spec.md](./test-specifications/schema-matching-test-spec.md)**:
  Schema validation specifications

### `/implementation/`

- **[README.md](./implementation/README.md)**: Implementation documentation
  overview
- **[template-format-flow.dot](./implementation/template-format-flow.dot)**:
  x-template-format feature component flow diagram
- **[template-format-modules.dot](./implementation/template-format-modules.dot)**:
  Module dependency diagram for template format feature
- **[template-format-sequence.md](./implementation/template-format-sequence.md)**:
  Detailed sequence diagrams and data flow
- **[template-format-examples.md](./implementation/template-format-examples.md)**:
  Concrete usage examples and implementation traces

---

## Usage Guidelines

### For Users

1. Start with [Transformation Model](./concepts/transformation-model.md) to
   understand the concept
2. Use [Directive Selection Guide](./guides/directive-selection.md) to choose
   directives
3. Refer to [Schema Extensions Reference](./schema-extensions.md) for syntax
4. Check [Troubleshooting Guide](./troubleshooting.md) for common issues

### For Developers

1. Start with [architecture/README.md](./architecture/README.md) for system
   overview
2. Review
   [architecture/design-principles.md](./architecture/design-principles.md)
   before creating services
3. Follow
   [architecture/canonical-processing-paths.md](./architecture/canonical-processing-paths.md)
   for implementation

### For Architects

1. Use [architecture/design-principles.md](./architecture/design-principles.md)
   for governance decisions
2. Maintain
   [architecture/canonical-processing-paths.md](./architecture/canonical-processing-paths.md)
   as single source of truth

### For Implementation Analysis

1. Refer to [implementation/README.md](./implementation/README.md) for current
   implementation status
2. Use implementation documentation to understand actual code flow and
   dependencies
3. Update implementation docs when making structural changes

**Authority**: This documentation establishes definitive project standards. All
development decisions must align with these principles.
