# DDD and Totality-based Refactoring Tasks

## Current Issues to Address

### Issue #340: Duplicate prompt files scattered across locations

- [ ] Investigate duplicate prompt files in the project
- [ ] Analyze current prompt file organization structure
- [ ] Identify duplicates and consolidation opportunities
- [ ] Design unified prompt file structure following DDD principles
- [ ] Implement consolidation plan
- [ ] Update references to consolidated files
- [ ] Verify no functionality is broken

### Issue #342: Mixed Japanese/English documentation inconsistency

- [ ] Audit documentation language consistency
- [ ] Standardize documentation language approach
- [ ] Update inconsistent documentation files

### Architecture Improvement

- [ ] Review current DDD implementation
- [ ] Identify areas for Totality principle application
- [ ] Implement type safety improvements
- [ ] Ensure all functions are total (no partial functions)

## Status

- Started: $(date)
- Branch: fix-duplicate-result-types
- Next: Investigate duplicate prompt files

## Progress Update

### ✅ Completed Tasks

- [x] Investigate duplicate prompt files in the project
- [x] Analyze current prompt file organization structure
- [x] Identify duplicates and consolidation opportunities
- [x] Design unified prompt file structure following DDD principles
- [x] Implement consolidation plan
- [x] Update references to consolidated files
- [x] Remove duplicate directories: src/prompts/, src/infrastructure/prompts/,
      scripts/prompts/

### 🔄 Current Status

Created canonical domain-level prompts:

- `src/domain/prompts/extract-frontmatter.md` - Total function for frontmatter
  extraction
- `src/domain/prompts/map-to-template.md` - Total function for template mapping

Updated references in:

- `src/main.ts`
- `cli.ts`

### ➡️ Next Steps

- [ ] Run CI to verify no functionality is broken
- [ ] Test the consolidated prompts
- [ ] Address Issue #342 (mixed Japanese/English documentation)
