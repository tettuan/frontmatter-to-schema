# Known Issues Tracker

## 🔴 Critical Issues

### Issue #1: Empty Frontmatter Handling

- **Status**: FAILING
- **Test**: `test/test-edge-cases.ts:31`
- **Problem**: Empty YAML returns undefined instead of empty object
- **Impact**: Parser fails on valid markdown with empty frontmatter

### Issue #2: Invalid YAML Syntax

- **Status**: FAILING
- **Test**: `test/test-edge-cases.ts:19`
- **Problem**: Parser crashes on malformed YAML
- **Impact**: One bad file can break entire processing

### Issue #3: No Claude API Tests

- **Status**: MISSING
- **Problem**: API integration completely untested
- **Impact**: Unknown behavior in production

## 🟡 Medium Priority

### Issue #4: No Coverage Metrics

- **Problem**: Cannot measure test completeness
- **Impact**: Unknown code coverage percentage

### Issue #5: Poor Error Messages

- **Problem**: Errors logged to console without context
- **Impact**: Hard to debug in production

## 🟢 Low Priority

### Issue #6: No Progress Indicators

- **Problem**: Silent during long operations
- **Impact**: Poor user experience

---

Last Updated: 2025-08-19
