# Task Completion Checklist

## Pre-Implementation Checklist

### Analysis Phase

- [ ] Read and understand the task requirements
- [ ] Identify affected domain boundaries
- [ ] Check AI-complexity-control principles (entropy, gravity, convergence)
- [ ] Review Totality principles (eliminate partial functions, use Result types)
- [ ] Identify existing patterns to follow

### Design Phase

- [ ] Determine if changes fit within existing architecture
- [ ] Identify which layers need modification
      (domain/application/infrastructure)
- [ ] Plan for discriminated unions instead of optional properties
- [ ] Design Result types for error handling
- [ ] Consider smart constructors for value objects

## Implementation Checklist

### Code Quality

- [ ] Follow existing naming conventions
- [ ] Use TypeScript strict mode compliance
- [ ] Implement proper error handling with Result types
- [ ] Add JSDoc comments for public APIs
- [ ] Avoid `any` types - use `unknown` or specific types

### Domain-Driven Design Compliance

- [ ] Keep domain logic in domain layer
- [ ] Use ubiquitous language from domain documentation
- [ ] Maintain bounded context boundaries
- [ ] Implement value objects as immutable classes
- [ ] Use aggregates for consistency boundaries

### Totality Implementation

- [ ] Convert partial functions to total functions using Result types
- [ ] Replace optional properties with discriminated unions
- [ ] Use smart constructors with validation
- [ ] Implement comprehensive error types
- [ ] Ensure all switch statements are exhaustive

## Testing Checklist

### Test Coverage

- [ ] Write unit tests for new domain logic
- [ ] Add integration tests for external dependencies
- [ ] Test error cases and edge conditions
- [ ] Validate that Result types work correctly
- [ ] Test discriminated union exhaustiveness

### Test Quality

- [ ] Tests are independent and can run in any order
- [ ] Test names clearly describe the behavior being tested
- [ ] Tests focus on behavior, not implementation details
- [ ] Mock external dependencies appropriately
- [ ] Include both positive and negative test cases

## Code Quality Assurance

### Static Analysis

- [ ] `deno fmt` - Format code
- [ ] `deno lint` - Lint code
- [ ] `deno check` - Type check
- [ ] No TypeScript errors or warnings
- [ ] All imports are properly resolved

### Runtime Testing

- [ ] `./run-tests.sh` - All tests pass
- [ ] `deno task ci` - CI pipeline passes
- [ ] Main application runs without errors
- [ ] Examples still work (if applicable)

## Documentation Updates

### Code Documentation

- [ ] Update JSDoc comments for modified functions
- [ ] Add inline comments for complex logic
- [ ] Document any new patterns or approaches
- [ ] Update type definitions if interfaces changed

### Domain Documentation

- [ ] Update domain model if new concepts added
- [ ] Add new terms to ubiquitous language
- [ ] Document new bounded context interactions
- [ ] Update architecture diagrams if structure changed

## AI-Complexity-Control Validation

### Entropy Check

- [ ] Measure complexity increase (classes, interfaces, abstraction layers)
- [ ] Ensure entropy stays below established thresholds
- [ ] Consider refactoring if complexity grows significantly
- [ ] Document complexity decisions and trade-offs

### Functional Gravity Check

- [ ] Ensure related functions are properly grouped
- [ ] Verify loose coupling between unrelated components
- [ ] Check that domain boundaries are respected
- [ ] Validate that the "mass center" is preserved

### Pattern Convergence Check

- [ ] Use existing patterns instead of creating new ones
- [ ] Document why new patterns are necessary (if any)
- [ ] Ensure consistency with established conventions
- [ ] Validate that implementations follow project standards

## Final Validation

### Integration Testing

- [ ] Test with real frontmatter files
- [ ] Validate schema-driven analysis works
- [ ] Confirm template mapping produces expected output
- [ ] Test error scenarios and recovery

### Performance and Reliability

- [ ] No memory leaks in long-running processes
- [ ] Proper resource cleanup (files, connections)
- [ ] Graceful error handling and reporting
- [ ] Acceptable performance for expected data volumes

### Deployment Readiness

- [ ] All dependencies are properly declared
- [ ] Required permissions are documented
- [ ] Environment setup is documented
- [ ] Examples demonstrate the feature works

## Post-Implementation

### Review and Reflection

- [ ] Code review by peer (if possible)
- [ ] Validate that the solution meets original requirements
- [ ] Document lessons learned and patterns discovered
- [ ] Update project documentation if architecture evolved

### Monitoring and Maintenance

- [ ] Add logging for important operations
- [ ] Consider metrics for performance monitoring
- [ ] Document troubleshooting steps for common issues
- [ ] Plan for future maintenance and updates
