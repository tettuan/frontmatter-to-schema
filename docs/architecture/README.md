# Architecture Documentation

This directory contains the core architectural documentation for the
frontmatter-to-schema project.

## Core Documents

- **[phase-boundaries.md](./phase-boundaries.md)**: Processing phase boundaries
  and sub-module integration (yaml-schema-mapper, data-path-resolver,
  json-template)
- **[schema-directives-specification.md](./schema-directives-specification.md)**:
  Schema directives (x-\*) processing specification - 8-stage processing order
  including Stage 0 (yaml-schema-mapper) and dependencies
- **[template-processing-specification.md](./template-processing-specification.md)**:
  Complete template processing system specification including main processing
  flow (CLI → PipelineOrchestrator → OutputRenderingService)
- **[template-output-subdomain-separation.md](./template-output-subdomain-separation.md)**:
  Template output subdomain architecture - Clear separation between list
  aggregation and document iteration processing
- **[list-container-vs-list-items-separation.md](./list-container-vs-list-items-separation.md)**:
  Critical architectural principle - Separation between list containers and list
  items
- **[list-output-definition.md](./list-output-definition.md)**: Definitive
  definition of list output - What it is and what it is NOT
- **[x-template-items-specification.md](./x-template-items-specification.md)**:
  Specification for x-template-items functionality - Template reference
  management
- **[template-schema-domain-handoff.md](./template-schema-domain-handoff.md)**:
  Domain handoff mechanism for x-template-items between Template and Schema
  domains

## Sub-Module Architecture

The system uses three independent sub-modules for processing:

- **[yaml-schema-mapper](../../sub_modules/yaml-schema-mapper/README.md)**: Raw
  YAML → Schema-compliant data transformation (Stage 0)
- **[data-path-resolver](../../sub_modules/data-path-resolver/README.md)**: Path
  expression resolution for x-derived-from (Stage 4)
- **[json-template](../../sub_modules/json-template/README.md)**: Template
  variable substitution (Stage 7)

See [phase-boundaries.md](./phase-boundaries.md) for detailed integration
architecture.

## Purpose

These architectural documents establish:

- Definitive processing boundaries and rules
- Domain-driven design patterns
- Subdomain separation strategies
- Integration patterns between bounded contexts
- Sub-module integration architecture

## Authority

This documentation represents the authoritative architectural decisions for the
project. All development must align with these established patterns and
principles.
