# Architecture Documentation

This directory contains the core architectural documentation for the
frontmatter-to-schema project.

## Core Documents

### Template Processing System

- **[template-processing-specification.md](./template-processing-specification.md)**:
  Complete template processing system specification including main processing
  flow (CLI → PipelineOrchestrator → OutputRenderingService) with **Intermediate
  Representation (IR) layer**
- **[template-context-specification.md](./template-context-specification.md)**:
  **NEW** - Scope-aware template context system for accurate variable resolution
  during array expansion and nested contexts
- **[template-variable-resolution-roadmap.md](./template-variable-resolution-roadmap.md)**:
  **NEW** - Phased implementation roadmap for enhanced variable resolution
  system

### Domain Separation

- **[template-output-subdomain-separation.md](./template-output-subdomain-separation.md)**:
  Template output subdomain architecture - Clear separation between list
  aggregation and document iteration processing
- **[list-container-vs-list-items-separation.md](./list-container-vs-list-items-separation.md)**:
  Critical architectural principle - Separation between list containers and list
  items
- **[list-output-definition.md](./list-output-definition.md)**: Definitive
  definition of list output - What it is and what it is NOT

### Schema and Templates

- **[x-template-items-specification.md](./x-template-items-specification.md)**:
  Specification for x-template-items functionality - Template reference
  management
- **[template-schema-domain-handoff.md](./template-schema-domain-handoff.md)**:
  Domain handoff mechanism for x-template-items between Template and Schema
  domains
- **[schema-directives-specification.md](./schema-directives-specification.md)**:
  Schema directives (x-*) processing specification - 7-stage processing order
  and dependencies
- **[mapping-hierarchy-rules.md](./mapping-hierarchy-rules.md)**: Mapping
  hierarchy rules for {@items} processing with **enhanced scope-based
  resolution**

## Recent Enhancements

### Intermediate Representation Layer (Issue #1071)

The system now includes an Intermediate Representation (IR) layer that addresses
critical issues with template variable resolution:

1. **Problem Solved**: Variables like `{id.full}` within `{@items}` expansions
   were losing their array element context, resulting in empty values

2. **Solution Architecture**:
   - **IR Layer**: Normalizes directive-processed data into a tree structure
   - **Template Context**: Manages scope stacks for accurate variable resolution
   - **Scope Preservation**: Maintains proper context during array iterations

3. **Key Components**:
   - [IR Architecture](../domain/architecture/domain-architecture-intermediate-representation.md)
   - [Template Context System](./template-context-specification.md)
   - [Implementation Roadmap](./template-variable-resolution-roadmap.md)
   - [Test Strategy](../tests/template-ir-test-strategy.md)

4. **Benefits**:
   - Deep path resolution (`{nested.path.to.value}`) works correctly
   - Array element scope preserved during `{@items}` expansion
   - Fallback chain from local to global scope
   - Enhanced error context for debugging

## Purpose

These architectural documents establish:

- Definitive processing boundaries and rules
- Domain-driven design patterns
- Subdomain separation strategies
- Integration patterns between bounded contexts

## Authority

This documentation represents the authoritative architectural decisions for the
project. All development must align with these established patterns and
principles.
