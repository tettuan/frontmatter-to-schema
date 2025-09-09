# Architecture Documentation

## Overview

This directory contains the comprehensive architectural documentation for the
frontmatter-to-schema project, created in response to the architectural crisis
discovered in September 2025.

## Crisis Background

During implementation of a traceability schema system, we discovered that
**template processing was completely bypassed in production** despite
comprehensive template infrastructure existing. Investigation revealed
systematic architectural duplication with multiple competing implementations for
the same concerns.

## Documentation Structure

### 1. [Root Cause Analysis](./root-cause-analysis.md)

**Purpose**: Comprehensive analysis of why multiple implementations proliferated

**Key Findings**:

- Excessive extraction without deletion pattern
- AI Complexity Control misapplication
- 12+ services extracted from single use case
- Untested production code vs well-tested unused code

### 2. [Canonical Processing Paths](./canonical-processing-paths.md)

**Purpose**: Definitive guide to prevent future architectural duplication

**Defines**:

- Single authoritative path for each domain concern
- Deprecated implementations scheduled for removal
- Implementation rules and constraints
- Migration timeline and phases

### 3. [Design Principles](./design-principles.md)

**Purpose**: Architectural governance and design standards

**Establishes**:

- Core design principles (Single Path, Totality, etc.)
- Service creation approval process
- Code review requirements
- Monitoring and enforcement procedures

## Architectural Mandates

### Non-Negotiable Requirements

1. **Single Path Rule**: All processing must use the canonical path for each
   domain concern
2. **Template System Integrity**: No raw data processing that bypasses template
   transformation
3. **Integration Test Coverage**: All processing paths must have end-to-end
   validation

### Governance Principles

1. **Canonical Implementation Rule**: Each domain concern must have exactly one
   authoritative processing path
2. **Explicit Deprecation Protocol**: All refactoring must include removal
   timeline for replaced implementations
3. **Architectural Review Process**: New services require explicit approval and
   justification

## Architectural Implementation Requirements

### Foundation Requirements

- **Root Cause Analysis**: All architectural decisions must include analysis of
  why competing implementations emerged
- **Canonical Path Definition**: Each domain concern must have exactly one
  authoritative processing path
- **Governance Framework**: Design principles must be established and enforced
  through code review
- **Comprehensive Documentation**: All architectural decisions must be
  documented with rationale

### Operational Requirements

- **Template Processing Integrity**: All document processing must route through
  template system without bypass
- **Deprecated Code Management**: Removal timeline must be specified for all
  deprecated implementations
- **Integration Test Coverage**: End-to-end workflows must be validated through
  comprehensive testing

### Continuous Improvement Requirements

- **Architectural Testing**: Automated tests must prevent duplication patterns
- **Review Process Integration**: Code review must enforce architectural
  principles
- **Regular Audit Process**: Monthly architectural compliance audits must be
  conducted

## Usage Guidelines

### For Developers

1. **Before Creating Services**: Read
   [Design Principles](./design-principles.md) approval process
2. **For Processing Tasks**: Use paths defined in
   [Canonical Processing Paths](./canonical-processing-paths.md)
3. **When Refactoring**: Follow explicit deprecation protocol

### For Architects

1. **Review Changes**: Use code review requirements checklist
2. **Approve Services**: Apply service creation approval criteria
3. **Monitor Compliance**: Conduct regular architectural audits

### For Product Owners

1. **Understand Impact**: Review root cause analysis findings
2. **Support Migration**: Allocate time for deprecated code removal
3. **Invest in Quality**: Support integration testing and governance

## Authority and Maintenance

**Authority**: This architecture documentation establishes the definitive
standards for the project. All architectural decisions must align with these
principles.

**Maintenance**: Architecture documents require quarterly review and update to
maintain relevance and accuracy.

**Contact**: For architectural questions or proposed changes, create GitHub
issue with `architecture` label.

---

**Created**: September 2025 in response to template processing crisis\
**Last Updated**: September 2025\
**Next Review**: December 2025
