# Console.log Cleanup Tasks - Issue #356

## Analysis Summary

Found 11 console statements in 5 source files that need to be replaced with
proper logger.

## Files to Modify

### 1. src/domain/models/value-objects.ts

- [ ] Line 28: console.log in documentation comment (keep as example)

### 2. src/domain/shared/logging/logger.ts

- [ ] Lines 85,88,91,94: console.debug/info/warn/error in ConsoleLoggerAdapter
      (these are intentional - logger implementation)

### 3. src/application/cli.ts

- [ ] Line 208: console.log for help output (intentional - stdout output for
      CLI)

### 4. src/domain/pipeline/analysis-pipeline.ts

- [ ] Line 52: console.error → logger.error
- [ ] Line 95: console.warn → logger.warn
- [ ] Line 137: console.warn → logger.warn

### 5. src/main.ts

- [ ] Line 210: console.log for help output (intentional - stdout output for
      CLI)

## Implementation Plan

### Phase 1: Identify Replaceable Console Statements

✅ Completed - Found 3 replaceable statements in analysis-pipeline.ts

### Phase 2: Update analysis-pipeline.ts

- [ ] Import LoggerFactory
- [ ] Create logger instance
- [ ] Replace 3 console statements with logger calls
- [ ] Verify proper error handling

### Phase 3: Review Intentional Console Usage

- [ ] Document why console.log is kept in CLI help output
- [ ] Document why console methods are used in ConsoleLoggerAdapter
- [ ] Ensure documentation examples are marked as such

### Phase 4: Testing

- [ ] Run unit tests for analysis-pipeline.ts
- [ ] Run integration tests
- [ ] Verify log output format

### Phase 5: CI Verification

- [ ] Run deno task ci
- [ ] Ensure all tests pass
- [ ] Verify no new linting issues

## Notes

- Most console statements are intentional (logger implementation, CLI output,
  documentation)
- Only 3 actual console statements need replacement in analysis-pipeline.ts
- Logger infrastructure already exists and is properly designed following
  DDD/Totality principles
