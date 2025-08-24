# Refactoring Tasks for Issue #377

## Objective
Reduce over-engineering by consolidating files from 80 → ~60

## Phase 1: Directory Flattening (Quick Wins)
- [x] Analyze directory structure
- [ ] Move src/domain/extraction/frontmatter-extractor.ts → src/domain/services/
- [ ] Move src/domain/registry/types.ts → src/domain/core/
- [ ] Move src/domain/schema/TypeScriptSchemaMatcher.ts → src/domain/models/
- [ ] Move src/domain/prompt/* → src/domain/services/
- [ ] Remove empty src/domain/prompts/ directory
- [ ] Update all imports for moved files

**Expected reduction: 5 directories, ~3-4 files consolidated**

## Phase 2: Analyzer Consolidation  
- [x] Consolidated mock analyzers (DONE)
- [ ] Consolidate claude-analyzer.ts + claude-schema-analyzer.ts
- [ ] Consider consolidating TypeScript analyzer with base implementation
- [ ] Update imports in cli.ts and application files

**Expected reduction: 2 files**

## Phase 3: Core Simplification
- [ ] Review src/domain/core/ (12 files) for consolidation opportunities
- [ ] Merge related type definitions
- [ ] Consolidate interfaces that are only used once

## Phase 4: Template Consolidation
- [ ] Review src/domain/template/ (11 files) for over-abstraction
- [ ] Consolidate strategy implementations if possible

## Current Progress
- Files: 80 → 80 (mock consolidation done)
- Target: ~60 files
- Directories to remove: 5
- Files to consolidate: ~20

## Next Immediate Action
Start with Phase 1 directory flattening as it provides quick wins with minimal risk.
