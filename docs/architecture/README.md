# Architecture Documentation

This directory contains the core architectural documentation for the
frontmatter-to-schema project.

## Core Documents

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
- **[schema-directives-specification.md](./schema-directives-specification.md)**:
  Schema directives (x-*) processing specification - 7-stage processing order and dependencies

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
