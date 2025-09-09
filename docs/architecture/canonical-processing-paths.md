# Canonical Processing Paths

## Purpose

This document defines the single authoritative processing path for each major
concern in the frontmatter-to-schema system. It serves as the definitive guide
to prevent future architectural duplication.

## Core Principle

**ONE PATH RULE**: For each domain concern, there shall be exactly one canonical
implementation path. All other implementations are considered deprecated and
scheduled for removal.

## Processing Domains

### 1. Document Processing Pipeline

**CANONICAL PATH**: `DocumentProcessor` → Services → Repositories

```
CLI Input → DocumentProcessor.process()
  ├── LoadSchemaUseCase.execute()
  ├── DiscoverFilesUseCase.execute()  
  ├── ExtractFrontmatterUseCase.execute()
  ├── ValidateFrontmatterUseCase.execute()
  ├── AggregateResultsUseCase.execute()
  └── WriteOutputUseCase.execute()
```

**Primary Implementation**: `src/application/document-processor.ts`

**DEPRECATED PATHS** (scheduled for deletion):

- ❌ `ProcessDocumentsOrchestrator` (bypasses templates)
- ❌ `ProcessDocumentsUseCase` (monolithic, replaced by use cases)
- ❌ All `src/domain/services/processing-*` micro-services

### 2. Configuration Loading

**CANONICAL PATH**: `ConfigurationOrchestrator` → Service → Repository

```
Configuration Request → ConfigurationOrchestrator
  ├── ConfigurationFileService.loadConfigurationFile()
  ├── SchemaConfigurationService.loadSchema()  
  ├── TemplateConfigurationService.loadTemplate()
  └── ResultManagementService (for output)
```

**Primary Implementation**:
`src/infrastructure/adapters/configuration-orchestrator.ts`

**DEPRECATED PATHS** (scheduled for deletion):

- ❌ `src/infrastructure/repositories/configuration-repository-impl.ts`
- ❌ `src/infrastructure/repositories/schema-repository-impl.ts`
- ❌ Original `configuration-loader.ts` (if still exists)

### 3. Schema Processing

**CANONICAL PATH**: Domain Services → Value Objects

```
Schema Request → SchemaValidator.validate()
  ├── SchemaRefResolver.resolveAndExtractTemplateInfo()
  ├── Schema.create() [Value Object]
  └── Template.create() [Value Object]
```

**Primary Implementation**: `src/domain/services/schema-validator.ts`

**DEPRECATED PATHS**: None currently identified

### 4. Template Processing

**CANONICAL PATH**: Template Adapter → Template Engine

```
Template Application → UnifiedTemplateMapperAdapter.applyTemplateMapping()
  ├── TemplateEngine.compile()
  ├── TemplateEngine.render()
  └── Template validation and transformation
```

**Primary Implementation**:
`src/infrastructure/adapters/template-mapper-adapter.ts`

**CRITICAL**: This path was being bypassed. All raw frontmatter pushing is
forbidden.

### 5. Frontmatter Extraction

**CANONICAL PATH**: Extractor Factory → Format-Specific Extractors

```
Content → FrontmatterExtractor.extract()
  ├── ExtractorFactory.createExtractor()
  ├── Format-specific extractor (yaml/json/toml)
  └── FrontmatterData [Value Object]
```

**Primary Implementation**: `src/domain/services/frontmatter-extractor.ts`

**Supporting Modules**: `src/domain/extractors/*` (format-specific)

## Architectural Constraints

### 1. Single Responsibility Enforcement

Each use case handles exactly one business concern:

- ✅ `LoadSchemaUseCase` - loads and validates schemas
- ✅ `ExtractFrontmatterUseCase` - extracts frontmatter from content
- ✅ `ValidateFrontmatterUseCase` - validates extracted data
- ❌ No "ProcessEverythingUseCase" mega-services

### 2. Dependency Direction

```
CLI → Application → Domain → Infrastructure
```

- CLI depends only on Application
- Application orchestrates Domain use cases
- Domain contains business logic, no infrastructure dependencies
- Infrastructure implements domain interfaces

### 3. Result Type Usage

All operations return `Result<T, E>` types following Totality principles:

- Success path: `{ ok: true, data: T }`
- Error path: `{ ok: false, error: E }`
- No exceptions for business logic failures

## Implementation Rules

### DO

✅ Use the canonical path for your domain concern\
✅ Extend existing use cases rather than create new ones\
✅ Follow the established dependency directions\
✅ Maintain comprehensive error handling with Result types\
✅ Add integration tests for new functionality

### DON'T

❌ Create competing implementations\
❌ Bypass template processing\
❌ Push raw frontmatter data\
❌ Create micro-services for simple operations\
❌ Leave deprecated code after refactoring

## Implementation Protocol

### Critical Path Requirements

- **Template Processing Integrity**: All document processing must route through
  canonical `DocumentProcessor` path
- **Deprecated Path Isolation**: All non-canonical processing paths must be
  disabled and marked for removal
- **End-to-End Validation**: Integration tests must validate complete processing
  workflows

### Consolidation Standards

- **Service Boundary Enforcement**: Eliminate micro-services that fragment
  single domain concerns
- **Configuration Singularity**: Maintain exactly one configuration loading
  implementation per domain
- **Test Path Alignment**: All tests must validate canonical processing paths
  exclusively

### Governance Integration

- **Code Review Standards**: New service creation must follow explicit
  architectural approval process
- **Duplication Prevention**: Automated architectural tests must prevent
  competing implementation patterns
- **Documentation Maintenance**: Service creation approval process must be
  documented and enforced

## Enforcement

### Code Review Requirements

- New service creation requires architectural review
- All processing must go through canonical paths
- No raw data bypassing without explicit documentation

### Testing Requirements

- Integration tests must cover end-to-end canonical paths
- Unit tests for individual use cases and services
- Architectural tests to prevent duplication patterns

### Monitoring

- Regular audits of service proliferation
- Detection of bypass patterns in code reviews
- Measurement of canonical path adherence

---

**CRITICAL**: This document is the single source of truth for processing paths.
Any deviation requires explicit architectural approval and documentation update.
